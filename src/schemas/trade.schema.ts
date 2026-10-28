import { z } from "zod";
import { MAX_ARROBA_LIVE_FACTOR_KG } from "../lib/farm.js";
import { MAX_NAME_LENGTH, calendarDate, notes, unitPrice, weightKg } from "./common.schema.js";
import { newAnimalSchema } from "./animal.schema.js";

// Negociações — compra e venda (G5, "Espec — Compra e venda").
//
// O schema confere a FORMA do pedido. As regras que dependem de outros campos
// (arroba precisa de base; peso vivo obrigatório, exceto por cabeça; carcaça só
// na arroba por carcaça) são conferidas em src/lib/trades.ts, porque valem
// também na edição, depois de juntar o que já existe com o que mudou.

export const TRADE_TYPES = ["PURCHASE", "SALE"] as const;
export const PRICE_UNITS = ["PER_KG", "PER_ARROBA", "PER_HEAD"] as const;
export const ARROBA_BASES = ["CARCASS", "LIVE_FACTOR"] as const;

// Limite técnico de animais numa negociação (RN-NEG-017)
export const MAX_TRADE_ITEMS = 5000;

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

const tradeType = z.enum(TRADE_TYPES, "Escolha compra ou venda.");
const priceUnit = z.enum(PRICE_UNITS, "Escolha por kg, por arroba ou por cabeça.");
const arrobaBasis = z.enum(ARROBA_BASES, "Escolha arroba de carcaça ou de peso vivo.");

const arrobaFactorKg = z
  .number({ error: "O fator da arroba deve ser um número." })
  .positive("O fator da arroba deve ser maior que zero.")
  .max(MAX_ARROBA_LIVE_FACTOR_KG, `O fator da arroba pode ser no máximo ${MAX_ARROBA_LIVE_FACTOR_KG} kg.`)
  .refine(hasAtMostTwoDecimals, {
    message: "O fator da arroba aceita no máximo 2 casas decimais.",
    params: { code: "MAX_2_DECIMALS" },
  });

const counterparty = z.string().trim().max(MAX_NAME_LENGTH, `Use no máximo ${MAX_NAME_LENGTH} caracteres.`);

// Lista sem o mesmo id duas vezes
const noRepeated = <T>(pick: (item: T) => string) => ({
  check: (items: T[]) => new Set(items.map(pick)).size === items.length,
  issue: {
    message: "O mesmo animal foi incluído mais de uma vez.",
    params: { code: "DUPLICATE_ITEMS" },
  },
});

// ── Criar ──

// Cada linha é um animal JÁ cadastrado (animalId) ou, na compra em lote, um
// animal NOVO que é cadastrado junto com a compra (newAnimal — D-36).
const newItem = z
  .object({
    animalId: z.uuid("Animal inválido.").optional(),
    newAnimal: newAnimalSchema.optional(),
    liveWeightKg: weightKg.nullable().optional(),
    carcassWeightKg: weightKg.nullable().optional(), // pode ficar pendente (D-35)
    unitPrice,
    // O preço deste animal é diferente do da categoria (RN-NEG-018/021)
    priceAdjusted: z.boolean().optional(),
    // Valor calculado pela tela: aceito e IGNORADO — o servidor recalcula (RN-NEG-010)
    value: z.unknown().optional(),
  })
  .strict()
  .refine((item) => item.animalId !== undefined || item.newAnimal !== undefined, {
    message: "Escolha o animal.",
    path: ["animalId"],
    params: { code: "REQUIRED" },
  })
  .refine((item) => item.animalId === undefined || item.newAnimal === undefined, {
    message: "Use um animal cadastrado OU um animal novo, não os dois.",
    path: ["newAnimal"],
    params: { code: "NOT_ALLOWED" },
  });

// O mesmo animal cadastrado não entra duas vezes (os novos são conferidos
// pelo brinco, na rota, com o erro na linha certa)
const uniqueAnimals = {
  check: (items: { animalId?: string }[]) => {
    const ids = items.flatMap((item) => (item.animalId ? [item.animalId] : []));
    return new Set(ids).size === ids.length;
  },
  issue: { message: "O mesmo animal foi incluído mais de uma vez.", params: { code: "DUPLICATE_ITEMS" } },
};

export const createTradeSchema = z
  .object({
    type: tradeType,
    date: calendarDate,
    priceUnit,
    arrobaBasis: arrobaBasis.optional(),
    arrobaFactorKg: arrobaFactorKg.optional(), // sem valor: o da fazenda
    counterparty: counterparty.optional(),
    notes: notes.optional(),
    // Mesmo identificador enviado de novo = a mesma negociação (RN-NEG-016)
    idempotencyKey: z.uuid("Identificador da operação inválido.").optional(),
    // Venda com animal em carência registrada: o produtor viu o aviso e
    // decidiu registrar mesmo assim (RN-SAN-010 — aviso, não bloqueio)
    acknowledgeWithdrawal: z.boolean().optional(),
    items: z
      .array(newItem)
      .min(1, "Inclua pelo menos um animal.")
      .max(MAX_TRADE_ITEMS, `No máximo ${MAX_TRADE_ITEMS} animais por negociação.`)
      .refine(uniqueAnimals.check, uniqueAnimals.issue),
    // Total calculado pela tela: aceito e IGNORADO (RN-NEG-010)
    total: z.unknown().optional(),
  })
  .strict();

export type CreateTradeInput = z.infer<typeof createTradeSchema>;

// ── Corrigir (PATCH: muda só o que veio) ──

const itemUpdate = z
  .object({
    id: z.uuid("Item inválido."),
    liveWeightKg: weightKg.nullable().optional(),
    carcassWeightKg: weightKg.nullable().optional(),
    unitPrice: unitPrice.optional(),
    priceAdjusted: z.boolean().optional(),
    value: z.unknown().optional(),
  })
  .strict();

const uniqueItems = noRepeated<{ id: string }>((item) => item.id);

export const updateTradeSchema = z
  .object({
    date: calendarDate,
    priceUnit,
    arrobaBasis: arrobaBasis.nullable(),
    arrobaFactorKg: arrobaFactorKg.nullable(),
    counterparty: counterparty.nullable(),
    notes: notes.nullable(),
    items: z
      .array(itemUpdate)
      .max(MAX_TRADE_ITEMS, `No máximo ${MAX_TRADE_ITEMS} animais por negociação.`)
      .refine(uniqueItems.check, uniqueItems.issue),
    total: z.unknown(),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).some((key) => key !== "total"), {
    message: "Envie pelo menos um campo para alterar.",
    params: { code: "EMPTY_UPDATE" },
  });

export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;

// ── Rotas com id ──

export const tradeIdParamSchema = z.object({ id: z.uuid("Negociação inválida.") });

export const tradeItemParamsSchema = z.object({
  id: z.uuid("Negociação inválida."),
  itemId: z.uuid("Item inválido."),
});

// ── Listar ──

const booleanText = z.enum(["true", "false"], "Use true ou false.").transform((value) => value === "true");

export const listTradesQuerySchema = z
  .object({
    type: tradeType.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    pending: booleanText.optional(), // só as que aguardam o peso de carcaça
    // busca por comprador/vendedor ou brinco de um animal da negociação
    q: z.string().trim().min(1).max(60).optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// GET /trades/summary — números do topo da tela (mesmos filtros da lista, sem página)
export const tradesSummaryQuerySchema = z
  .object({
    type: tradeType.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    pending: booleanText.optional(),
    q: z.string().trim().min(1).max(60).optional(),
  })
  .strict();

// ── Último preço usado (só referência — RN-NEG-020) ──

export const lastPricesQuerySchema = z
  .object({
    type: tradeType,
    priceUnit,
    arrobaBasis: arrobaBasis.optional(),
  })
  .strict();
