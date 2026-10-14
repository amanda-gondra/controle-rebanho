import type { DealDraft } from "../components/TradeDealFields.js";
import type { Trade } from "./trade.js";
import type { Category, Sex } from "./animal.js";
import { SEX_OF_LABEL_KEY, type CategoryLabelKey } from "./categories.js";
import {
  evaluateRow,
  groupKeyOf,
  parseDecimalInput,
  sumValues,
  decimalToInput,
  type DraftRow,
  type GroupBy,
  type Pricing,
} from "./tradeMath.js";
import { fieldErrorMessage } from "../i18n/errors.js";
import { t } from "../i18n/index.js";
import { formatNumber } from "./format.js";

// O formulário da negociação (criar e corrigir usam o mesmo): confere o que a
// pessoa digitou, monta o que vai para a API e distribui os erros que voltam
// (por campo da negociação ou por linha/animal). Sem React aqui: testável.

// Limite do fator (o mesmo do servidor: src/lib/farm.ts)
export const MAX_ARROBA_FACTOR_KG = 99.99;

export type DealCheck = { pricing: Pricing | null; errors: Record<string, string> };

// Forma de preço + fator digitado → Pricing (ou os erros dos campos)
export function checkDeal(deal: DealDraft): DealCheck {
  const errors: Record<string, string> = {};
  if (!deal.date) errors.date = t("trade.dateRequired");

  let factor: string | null = null;
  if (deal.priceUnit === "PER_ARROBA") {
    if (!deal.arrobaBasis) errors.arrobaBasis = t("trade.arrobaBasisRequired");
    if (deal.arrobaBasis === "LIVE_FACTOR") {
      const parsed = parseDecimalInput(deal.factor);
      if (!parsed || Number(parsed) <= 0 || Number(parsed) > MAX_ARROBA_FACTOR_KG) {
        errors.arrobaFactorKg = t("trade.factorInvalid", { max: formatNumber(MAX_ARROBA_FACTOR_KG) });
      } else {
        factor = parsed;
      }
    }
  }

  const pricing: Pricing | null =
    Object.keys(errors).length > 0
      ? null
      : {
          priceUnit: deal.priceUnit,
          arrobaBasis: deal.priceUnit === "PER_ARROBA" ? deal.arrobaBasis : null,
          arrobaFactorKg: factor,
        };
  return { pricing, errors };
}

export type ItemPayload = {
  liveWeightKg: string | null;
  carcassWeightKg: string | null;
  unitPrice: string;
  priceAdjusted: boolean;
};

export type RowsCheck = {
  ok: boolean; // todas as linhas certas (pendência de carcaça pode)
  items: ItemPayload[]; // na mesma ordem das linhas
  total: string; // soma dos valores conhecidos
  awaitingCarcass: number;
};

// Confere todas as linhas e monta os itens (o valor NÃO vai: quem calcula é o servidor)
export function checkRows(
  rows: DraftRow[],
  pricing: Pricing,
  groupBy: GroupBy,
  groupPrices: Record<string, string>,
): RowsCheck {
  const evaluated = rows.map((row) => evaluateRow(row, pricing, groupPrices[groupKeyOf(row.animal, groupBy)] ?? ""));
  const ok = evaluated.every((row) => Object.keys(row.problems).length === 0);
  return {
    ok,
    items: evaluated.map((row) => ({
      liveWeightKg: row.liveWeightKg,
      carcassWeightKg: row.carcassWeightKg,
      unitPrice: row.price ?? "0.00",
      priceAdjusted: row.adjusted,
    })),
    total: sumValues(evaluated.map((row) => row.value)),
    awaitingCarcass: evaluated.filter((row) => row.awaitingCarcass).length,
  };
}

// ── Erros que voltam da API ──

type ApiFieldError = { field: string; code?: string; params?: Record<string, unknown> };

export type SplitErrors = {
  deal: Record<string, string>; // date, arrobaBasis, arrobaFactorKg, counterparty, notes
  rows: Record<string, string>; // chave da linha → frase
  hasAny: boolean;
};

// "items.3.animalId" → linha 3 (mesma ordem que foi enviada)
export function splitApiErrors(err: unknown, rowKeys: string[]): SplitErrors {
  const list = (err && typeof err === "object" ? (err as { errors?: ApiFieldError[] }).errors : undefined) ?? [];
  const deal: Record<string, string> = {};
  const rows: Record<string, string> = {};
  for (const fieldError of list) {
    const match = /^items\.(\d+)\./.exec(fieldError.field ?? "");
    if (match) {
      const key = rowKeys[Number(match[1])];
      if (key) rows[key] ??= fieldErrorMessage(fieldError);
    } else if (fieldError.field) {
      deal[fieldError.field] ??= fieldErrorMessage(fieldError);
    }
  }
  return { deal, rows, hasAny: Object.keys(deal).length + Object.keys(rows).length > 0 };
}

// ── Correção: começar o formulário com o que a negociação já tem ──

export type EditStart = {
  deal: DealDraft;
  rows: DraftRow[];
  groupBy: GroupBy;
  groupPrices: Record<string, string>;
};

// Preço de cada grupo = o dos animais sem preço ajustado; quem tem preço
// diferente do grupo entra com preço individual. Se a mesma categoria tem
// preços diferentes sem ajuste, a negociação foi feita por categoria + raça.
export function startEdit(trade: Trade, farmFactor: number): EditStart {
  const pickGroupBy = (): GroupBy => {
    const seen = new Map<string, string>();
    for (const item of trade.items) {
      if (item.priceAdjusted) continue;
      const key = groupKeyOf(item.animal, "category");
      const previous = seen.get(key);
      if (previous !== undefined && previous !== item.unitPrice) return "categoryBreed";
      seen.set(key, item.unitPrice);
    }
    return "category";
  };
  const groupBy = pickGroupBy();

  const groupPrice = new Map<string, string>();
  for (const item of trade.items) {
    const key = groupKeyOf(item.animal, groupBy);
    if (!item.priceAdjusted && !groupPrice.has(key)) groupPrice.set(key, item.unitPrice);
  }

  const rows: DraftRow[] = trade.items.map((item) => {
    const own = groupPrice.get(groupKeyOf(item.animal, groupBy));
    return {
      key: item.id,
      animal: item.animal,
      liveWeight: decimalToInput(item.liveWeightKg),
      carcassWeight: decimalToInput(item.carcassWeightKg),
      individualPrice: own === item.unitPrice ? null : decimalToInput(item.unitPrice),
      selectionPrice: null,
    };
  });

  return {
    deal: {
      date: trade.date,
      priceUnit: trade.priceUnit,
      arrobaBasis: trade.arrobaBasis,
      factor: decimalToInput(trade.arrobaFactorKg ?? String(farmFactor.toFixed(2))),
      counterparty: trade.counterparty ?? "",
      notes: trade.notes ?? "",
    },
    rows,
    groupBy,
    groupPrices: Object.fromEntries([...groupPrice].map(([key, price]) => [key, decimalToInput(price)])),
  };
}

// ── Animais novos na compra em lote (D-36) ──
//
// Uma linha por animal comprado. A categoria é escolhida pelos 7 nomes da
// fazenda (bezerro, garrote, boi, touro, bezerra, novilha, vaca): o nome já diz
// o sexo, então a pessoa escolhe UMA coisa só.

export type NewAnimalDraft = {
  key: string; // "new-1", "new-2"...
  tag: string;
  group: CategoryLabelKey | "";
  castrated: boolean; // só vale para machos
  breed: string;
};

export function profileOfGroup(group: CategoryLabelKey): { sex: Sex; category: Category } {
  return {
    sex: SEX_OF_LABEL_KEY[group],
    category: group === "CALF_MALE" || group === "CALF_FEMALE" ? "CALF" : group,
  };
}

// Problemas de cada linha antes de enviar (o servidor confere de novo):
// brinco vazio, repetido na lista ou já usado na fazenda; categoria vazia.
export function checkNewAnimals(rows: NewAnimalDraft[], existingTags: Set<string>): Record<string, string> {
  const problems: Record<string, string> = {};
  const count = new Map<string, number>();
  for (const row of rows) count.set(row.tag.trim(), (count.get(row.tag.trim()) ?? 0) + 1);
  for (const row of rows) {
    const tag = row.tag.trim();
    if (!tag) problems[row.key] = t("trade.newAnimals.tagRequired");
    else if (existingTags.has(tag)) problems[row.key] = t("errors.fieldCodes.DUPLICATE_TAG_IN_FARM", { tag });
    else if ((count.get(tag) ?? 0) > 1) problems[row.key] = t("errors.fieldCodes.DUPLICATE_TAG_IN_LIST", { tag });
    else if (!row.group) problems[row.key] = t("trade.newAnimals.categoryRequired");
  }
  return problems;
}

// O que vai para a API (castrado só para macho; raça vazia não vai)
export function newAnimalPayload(row: NewAnimalDraft) {
  const { sex, category } = profileOfGroup(row.group as CategoryLabelKey);
  return {
    tag: row.tag.trim(),
    sex,
    category,
    ...(sex === "MALE" ? { castrated: row.castrated } : {}),
    ...(row.breed.trim() ? { breed: row.breed.trim() } : {}),
  };
}
