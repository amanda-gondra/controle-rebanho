import { randomUUID } from "node:crypto";
import { calendarDateOf, toDbDate } from "./dates.js";
import { AppError, ErrorCode, type FieldError } from "./errors.js";
import type { FarmDb } from "./tenant.js";
import {
  checkAnimalForTrade,
  computeItemValue,
  findItemProblem,
  sumValues,
  type ArrobaBasis,
  type PriceUnit,
  type TradeAnimalProblem,
  type TradeType,
} from "../services/trade.service.js";

// Negociações (G5): o que as rotas de /trades precisam do banco. As contas e
// regras puras ficam em services/trade.service.ts; aqui se busca o que elas
// precisam, se monta o erro com código e se mexe nas pesagens e na situação
// dos animais junto com a negociação.

// O que estas funções usam do banco: serve tanto `request.db` quanto o
// cliente de dentro de uma transação
export type TradeTx = Pick<FarmDb, "trade" | "tradeItem" | "weighing" | "animal" | "applicationAnimal">;

export type Pricing = {
  priceUnit: PriceUnit;
  arrobaBasis: ArrobaBasis | null;
  arrobaFactorKg: string | null; // "30.00"
};

export type ItemAmounts = {
  liveWeightKg: number | string | null;
  carcassWeightKg: number | string | null;
  unitPrice: number | string;
};

const fixed2 = (value: number | string | null) => (value === null ? null : Number(value).toFixed(2));

// ── Forma de preço ──

// Junta forma de preço, base e fator, completando com a fazenda (fator) e
// limpando o que não vale para a forma escolhida (na edição, trocar de arroba
// para kg apaga a base e o fator). Erros de combinação viram erro de campo.
export function resolvePricing(
  input: {
    priceUnit: PriceUnit;
    arrobaBasis?: ArrobaBasis | null;
    arrobaFactorKg?: number | string | null;
  },
  farmFactorKg: number | string,
  explicit: { arrobaBasis: boolean; arrobaFactorKg: boolean },
): Pricing {
  const errors: FieldError[] = [];
  const isArroba = input.priceUnit === "PER_ARROBA";
  let arrobaBasis = input.arrobaBasis ?? null;
  let arrobaFactorKg = input.arrobaFactorKg ?? null;

  if (isArroba && !arrobaBasis) {
    errors.push({ field: "arrobaBasis", code: "REQUIRED", error: "Escolha arroba de carcaça ou de peso vivo." });
  }
  if (!isArroba && arrobaBasis) {
    if (explicit.arrobaBasis) {
      errors.push({ field: "arrobaBasis", code: "NOT_ALLOWED", error: "Só vale para preço por arroba." });
    }
    arrobaBasis = null;
  }
  if (arrobaBasis === "LIVE_FACTOR") {
    arrobaFactorKg ??= farmFactorKg;
  } else if (arrobaFactorKg !== null) {
    if (explicit.arrobaFactorKg) {
      errors.push({ field: "arrobaFactorKg", code: "NOT_ALLOWED", error: "Só vale para arroba de peso vivo." });
    }
    arrobaFactorKg = null;
  }

  if (errors.length > 0) throw validationError(errors);
  return { priceUnit: input.priceUnit, arrobaBasis, arrobaFactorKg: fixed2(arrobaFactorKg) };
}

function validationError(errors: FieldError[]) {
  return new AppError(400, ErrorCode.VALIDATION_ERROR, "Dados inválidos.", errors);
}

// Peso vivo obrigatório (exceto por cabeça), carcaça só na arroba por
// carcaça e nunca acima do peso vivo — linha por linha.
export function assertItemsFitPricing(pricing: Pricing, items: ItemAmounts[]) {
  const errors: FieldError[] = [];
  items.forEach((item, index) => {
    const problem = findItemProblem(pricing, item);
    if (problem === "LIVE_WEIGHT_REQUIRED") {
      errors.push({ field: `items.${index}.liveWeightKg`, code: "REQUIRED", error: "Informe o peso vivo." });
    } else if (problem === "CARCASS_WEIGHT_NOT_ALLOWED") {
      errors.push({
        field: `items.${index}.carcassWeightKg`,
        code: "NOT_ALLOWED",
        error: "Peso de carcaça só vale na arroba de carcaça.",
      });
    } else if (problem === "CARCASS_ABOVE_LIVE_WEIGHT") {
      errors.push({
        field: `items.${index}.carcassWeightKg`,
        code: "CARCASS_ABOVE_LIVE_WEIGHT",
        error: "O peso de carcaça não pode passar do peso vivo.",
      });
    }
  });
  if (errors.length > 0) throw validationError(errors);
}

export const itemValue = (pricing: Pricing, item: ItemAmounts) => computeItemValue(pricing, item);

// ── Pode cada animal entrar? ──

const day = (date: Date | null | undefined) => (date ? calendarDateOf(date) : null);

export type TradeAnimal = {
  id: string;
  tag: string;
  status: "ACTIVE" | "SOLD" | "DEAD";
  exitDate: Date | null;
  birthDate: Date | null;
  birthPrecision: string;
};

// Confere todos os animais de uma vez (poucas consultas, mesmo com 5.000).
// `ignoreTradeId`: na edição, a própria negociação não conta.
// Devolve os problemas por posição na lista (índice → problema).
export async function findAnimalProblems(
  db: TradeTx,
  type: TradeType,
  date: string,
  animals: TradeAnimal[],
  ignoreTradeId?: string,
): Promise<Map<string, TradeAnimalProblem>> {
  const ids = animals.map((animal) => animal.id);
  const notThisTrade = ignoreTradeId ? { NOT: { tradeId: ignoreTradeId } } : {};

  const [otherItems, weighings, applications] = await Promise.all([
    db.tradeItem.findMany({
      where: { animalId: { in: ids }, ...notThisTrade },
      select: { animalId: true, type: true, trade: { select: { date: true } } },
    }),
    // Última pesagem de cada animal, sem as criadas por esta negociação
    db.weighing.groupBy({
      by: ["animalId"],
      where: {
        animalId: { in: ids },
        ...(ignoreTradeId ? { NOT: { tradeItem: { is: { tradeId: ignoreTradeId } } } } : {}),
      },
      _max: { date: true },
    }),
    db.applicationAnimal.findMany({
      where: { animalId: { in: ids } },
      select: { animalId: true, application: { select: { date: true } } },
    }),
  ]);

  const lastWeighing = new Map(weighings.map((row) => [row.animalId, day(row._max.date)]));
  const lastApplication = new Map<string, string>();
  for (const row of applications) {
    const date = calendarDateOf(row.application.date);
    const current = lastApplication.get(row.animalId);
    if (!current || date > current) lastApplication.set(row.animalId, date);
  }
  const tradeDate = (animalId: string, tradeType: TradeType) =>
    day(otherItems.find((item) => item.animalId === animalId && item.type === tradeType)?.trade.date);

  const problems = new Map<string, TradeAnimalProblem>();
  for (const animal of animals) {
    const problem = checkAnimalForTrade(type, date, {
      status: animal.status,
      exitDate: day(animal.exitDate),
      birthDate: day(animal.birthDate),
      birthIsExact: animal.birthPrecision === "DAY_MONTH_YEAR",
      purchaseDate: tradeDate(animal.id, "PURCHASE"),
      saleDate: tradeDate(animal.id, "SALE"),
      lastWeighingDate: lastWeighing.get(animal.id) ?? null,
      lastApplicationDate: lastApplication.get(animal.id) ?? null,
    });
    if (problem) problems.set(animal.id, problem);
  }
  return problems;
}

// Erro por linha (RN-NEG-009: nada é gravado se algum animal não puder entrar)
export function tradeItemErrors(errors: FieldError[]) {
  return new AppError(
    422,
    ErrorCode.TRADE_ITEM_ERRORS,
    "Alguns animais não podem entrar nesta negociação.",
    errors,
  );
}

export function problemToFieldError(index: number, tag: string, problem: TradeAnimalProblem): FieldError {
  const { code, ...rest } = problem;
  return {
    field: `items.${index}.animalId`,
    code,
    params: { tag, ...rest },
    error: `${tag}: ${code}`,
  };
}

// ── Pesagens criadas pela negociação (D-08, RN-NEG-008) ──
//
// O peso vivo de cada animal vira a pesagem do dia da negociação. Se já houver
// uma pesagem MANUAL nesse dia, a da negociação a substitui (D-37: vale o peso
// da balança do embarque) e a pessoa é avisada. Se a pesagem do dia já for de
// OUTRA negociação (compra e venda no mesmo dia), este item fica sem pesagem
// (uma por dia — D-33). Por cabeça sem peso: nenhuma pesagem.

export type WeighingPlan = { weighingIds: Map<string, string | null>; replaced: number };

// Para uma negociação NOVA: tudo em poucas consultas.
export async function createTradeWeighings(
  tx: TradeTx,
  farmId: string,
  type: TradeType,
  date: string,
  items: { animalId: string; liveWeightKg: number | string | null }[],
): Promise<WeighingPlan> {
  const dbDate = toDbDate(date);
  const withWeight = items.filter((item) => item.liveWeightKg !== null);
  const existing = await tx.weighing.findMany({
    where: { animalId: { in: withWeight.map((item) => item.animalId) }, date: dbDate },
    select: { id: true, animalId: true, source: true },
  });

  const manual = existing.filter((weighing) => weighing.source === "MANUAL");
  const takenByTrade = new Set(existing.filter((w) => w.source !== "MANUAL").map((w) => w.animalId));
  if (manual.length > 0) {
    await tx.weighing.deleteMany({ where: { id: { in: manual.map((weighing) => weighing.id) } } });
  }

  const weighingIds = new Map<string, string | null>();
  const rows = withWeight
    .filter((item) => !takenByTrade.has(item.animalId))
    .map((item) => {
      const id = randomUUID();
      weighingIds.set(item.animalId, id);
      return {
        id,
        farmId,
        animalId: item.animalId,
        date: dbDate,
        weightKg: fixed2(item.liveWeightKg)!,
        source: type,
      };
    });
  if (rows.length > 0) await tx.weighing.createMany({ data: rows });

  return { weighingIds, replaced: manual.length };
}

// Para uma negociação CORRIGIDA: acerta a pesagem de um item (nova data,
// novo peso, peso que sumiu ou apareceu). Devolve o id da pesagem (ou null) e
// se substituiu uma manual.
export async function syncItemWeighing(
  tx: TradeTx,
  farmId: string,
  type: TradeType,
  date: string,
  item: { animalId: string; weighingId: string | null; liveWeightKg: number | string | null },
): Promise<{ weighingId: string | null; replaced: boolean }> {
  if (item.liveWeightKg === null) {
    if (item.weighingId) await tx.weighing.deleteMany({ where: { id: item.weighingId } });
    return { weighingId: null, replaced: false };
  }

  const dbDate = toDbDate(date);
  const sameDay = await tx.weighing.findFirst({
    where: { animalId: item.animalId, date: dbDate, ...(item.weighingId ? { NOT: { id: item.weighingId } } : {}) },
    select: { id: true, source: true },
  });

  let replaced = false;
  if (sameDay?.source === "MANUAL") {
    await tx.weighing.deleteMany({ where: { id: sameDay.id } });
    replaced = true;
  } else if (sameDay) {
    // O dia já tem a pesagem da outra negociação deste animal
    if (item.weighingId) await tx.weighing.deleteMany({ where: { id: item.weighingId } });
    return { weighingId: null, replaced: false };
  }

  const data = { date: dbDate, weightKg: fixed2(item.liveWeightKg)!, source: type };
  if (item.weighingId) {
    await tx.weighing.update({ where: { id: item.weighingId }, data });
    return { weighingId: item.weighingId, replaced };
  }
  const created = await tx.weighing.create({ data: { ...data, farmId, animalId: item.animalId } });
  return { weighingId: created.id, replaced };
}

// ── Desfazer (tirar animais / apagar a negociação) ──
//
// Venda desfeita: o animal volta a ATIVO e perde a data de saída (RN-NEG-006).
// A pesagem criada pela negociação é apagada (RN-PES-009). Animais criados
// por uma compra NÃO são apagados (D-10: podem ter pesagens e aplicações).
export async function revertItems(
  tx: TradeTx,
  items: { id: string; animalId: string; type: TradeType; weighingId: string | null }[],
) {
  const saleAnimals = items.filter((item) => item.type === "SALE").map((item) => item.animalId);
  const weighingIds = items.map((item) => item.weighingId).filter((id): id is string => id !== null);

  await tx.tradeItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
  if (weighingIds.length > 0) await tx.weighing.deleteMany({ where: { id: { in: weighingIds } } });
  if (saleAnimals.length > 0) {
    await tx.animal.updateMany({
      where: { id: { in: saleAnimals } },
      data: { status: "ACTIVE", exitDate: null, deathCause: null, deathCauseCertainty: null },
    });
  }
}

// ── O que a API devolve ──

export const TRADE_DETAIL_INCLUDE = {
  items: {
    include: {
      animal: { select: { id: true, tag: true, sex: true, category: true, breed: true, status: true } },
    },
    orderBy: { animal: { tag: "asc" as const } },
  },
} as const;

type DecimalLike = { toFixed: (digits: number) => string };
const money = (value: DecimalLike | null) => (value === null ? null : value.toFixed(2));

export type TradeRow = {
  id: string;
  type: TradeType;
  date: Date;
  priceUnit: PriceUnit;
  arrobaBasis: ArrobaBasis | null;
  arrobaFactorKg: DecimalLike | null;
  currency: string;
  counterparty: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    liveWeightKg: DecimalLike | null;
    carcassWeightKg: DecimalLike | null;
    unitPrice: DecimalLike;
    priceAdjusted: boolean;
    value: DecimalLike | null;
    weighingId: string | null;
    animal: { id: string; tag: string; sex: string; category: string; breed: string | null; status: string };
  }[];
};

export function toTradeView(trade: TradeRow) {
  const items = trade.items.map((item) => ({
    id: item.id,
    animal: item.animal,
    liveWeightKg: money(item.liveWeightKg),
    carcassWeightKg: money(item.carcassWeightKg),
    unitPrice: money(item.unitPrice)!,
    priceAdjusted: item.priceAdjusted,
    value: money(item.value),
    hasWeighing: item.weighingId !== null,
  }));
  const total = sumValues(items.map((item) => item.value));
  return {
    id: trade.id,
    type: trade.type,
    date: calendarDateOf(trade.date),
    priceUnit: trade.priceUnit,
    arrobaBasis: trade.arrobaBasis,
    arrobaFactorKg: money(trade.arrobaFactorKg),
    currency: trade.currency,
    counterparty: trade.counterparty,
    notes: trade.notes,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
    animalCount: items.length,
    // Com animal aguardando o peso de carcaça (D-35), o total fica pendente;
    // `knownTotal` é a soma do que já tem valor.
    total,
    knownTotal: sumValues(items.map((item) => item.value ?? "0.00")),
    pending: total === null,
    items,
  };
}
