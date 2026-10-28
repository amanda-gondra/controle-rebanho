import type { ArrobaBasis, PriceUnit } from "./trade.js";
import type { Category, Sex } from "./animal.js";
import { categoryLabelKey } from "./categories.js";

// Contas da negociação NA TELA (G5): só para mostrar o valor enquanto a pessoa
// digita. O que vale é o que o servidor calcula ao gravar (RN-NEG-010) — esta
// conta é a mesma do servidor (src/services/trade.service.ts) e um teste
// confere que as duas dão sempre o mesmo resultado.
//
// Tudo em centavos inteiros (BigInt): nada de ponto flutuante com dinheiro.

const ARROBA_CARCASS_KG = 15n;

function toHundredths(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function centsToString(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

const divideRoundingHalfUp = (numerator: bigint, denominator: bigint) =>
  (numerator * 2n + denominator) / (denominator * 2n);

export type Pricing = { priceUnit: PriceUnit; arrobaBasis: ArrobaBasis | null; arrobaFactorKg: string | null };

// Valor de um animal ("4500.00"), ou null se ainda não dá para calcular
// (falta peso, preço ou o peso de carcaça do romaneio).
export function itemValue(
  pricing: Pricing,
  item: { liveWeightKg: string | null; carcassWeightKg: string | null; unitPrice: string | null },
): string | null {
  if (!item.unitPrice) return null;
  const price = toHundredths(item.unitPrice);
  switch (pricing.priceUnit) {
    case "PER_HEAD":
      return centsToString(price);
    case "PER_KG":
      return item.liveWeightKg ? centsToString(divideRoundingHalfUp(toHundredths(item.liveWeightKg) * price, 100n)) : null;
    case "PER_ARROBA":
      if (pricing.arrobaBasis === "CARCASS") {
        return item.carcassWeightKg
          ? centsToString(divideRoundingHalfUp(toHundredths(item.carcassWeightKg) * price, ARROBA_CARCASS_KG * 100n))
          : null;
      }
      if (pricing.arrobaBasis === "LIVE_FACTOR" && item.liveWeightKg && pricing.arrobaFactorKg) {
        const factor = toHundredths(pricing.arrobaFactorKg);
        if (factor === 0n) return null;
        return centsToString(divideRoundingHalfUp(toHundredths(item.liveWeightKg) * price, factor));
      }
      return null;
  }
}

// Soma exata ("10009.89"); com algum valor faltando, soma só os conhecidos
export function sumValues(values: (string | null)[]): string {
  return centsToString(values.reduce<bigint>((sum, value) => sum + (value ? toHundredths(value) : 0n), 0n));
}

// ── O que a pessoa digita ──

// "1.234,56", "1234,5", "1234.56" → "1234.56"; vazio → null; inválido → undefined.
// No máximo 2 casas (como o servidor aceita).
export function parseDecimalInput(text: string): string | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const [whole, fraction = ""] = normalized.split(".");
  return `${BigInt(whole)}.${(fraction + "00").slice(0, 2)}`;
}

// "1234.50" → "1234,50" (para pôr de volta num campo de texto, no idioma da tela)
export function decimalToInput(value: string | null, decimalSeparator = ","): string {
  return value === null ? "" : value.replace(".", decimalSeparator);
}

// ── Grupos de preço (RN-NEG-018/019/022) ──

export type GroupBy = "category" | "categoryBreed";

// Os 7 nomes de categoria (bezerro e bezerra separados — D-38), e, se a
// pessoa quiser, também a raça. Sem raça informada = grupo "raça não informada".
export function groupKeyOf(animal: { category: Category; sex: Sex; breed: string | null }, groupBy: GroupBy): string {
  const category = categoryLabelKey(animal.category, animal.sex);
  if (groupBy === "category") return category;
  const breed = animal.breed?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return `${category}|${breed}`;
}

// O preço mais específico vale: individual > o dado aos selecionados > o da
// categoria (RN-NEG-021). Diferente do da categoria = "preço ajustado".
export function effectivePrice(
  row: { individualPrice: string | null; selectionPrice: string | null },
  groupPrice: string | null,
): { price: string | null; adjusted: boolean } {
  const price = row.individualPrice ?? row.selectionPrice ?? groupPrice;
  return { price, adjusted: price !== null && price !== groupPrice };
}

// ── Uma linha do assistente (um animal), como a pessoa digitou ──

export type DraftAnimal = { id: string; tag: string; sex: Sex; category: Category; breed: string | null };

export type DraftRow = {
  key: string; // id do animal (nova negociação) ou do item (correção)
  animal: DraftAnimal;
  liveWeight: string; // texto digitado
  carcassWeight: string;
  individualPrice: string | null; // texto digitado no "ajustar" deste animal
  selectionPrice: string | null; // preço dado a um grupo de animais marcados
};

export type RowProblem = "REQUIRED" | "INVALID" | "CARCASS_ABOVE_LIVE_WEIGHT";

export type EvaluatedRow = {
  liveWeightKg: string | null;
  carcassWeightKg: string | null;
  price: string | null;
  adjusted: boolean;
  value: string | null;
  awaitingCarcass: boolean; // arroba de carcaça sem o peso ainda (pode salvar — D-35)
  problems: { liveWeight?: RowProblem; carcassWeight?: RowProblem; price?: RowProblem };
};

// Confere e calcula uma linha: o que falta, o que está errado e o valor
export function evaluateRow(row: DraftRow, pricing: Pricing, groupPriceText: string): EvaluatedRow {
  const problems: EvaluatedRow["problems"] = {};
  const live = parseDecimalInput(row.liveWeight);
  const carcass = parseDecimalInput(row.carcassWeight);
  const groupPrice = parseDecimalInput(groupPriceText) ?? null;
  const individual = row.individualPrice === null ? null : parseDecimalInput(row.individualPrice);
  const selection = row.selectionPrice === null ? null : parseDecimalInput(row.selectionPrice);
  const carcassBasis = pricing.priceUnit === "PER_ARROBA" && pricing.arrobaBasis === "CARCASS";

  if (live === undefined) problems.liveWeight = "INVALID";
  else if (live === null && pricing.priceUnit !== "PER_HEAD") problems.liveWeight = "REQUIRED";
  else if (live === "0.00") problems.liveWeight = "INVALID";

  if (carcassBasis) {
    if (carcass === undefined || carcass === "0.00") problems.carcassWeight = "INVALID";
    else if (carcass && live && Number(carcass) > Number(live)) problems.carcassWeight = "CARCASS_ABOVE_LIVE_WEIGHT";
  }

  const { price, adjusted } = effectivePrice(
    { individualPrice: individual ?? null, selectionPrice: selection ?? null },
    groupPrice,
  );
  if (individual === undefined || selection === undefined) problems.price = "INVALID";
  else if (price === null) problems.price = "REQUIRED";
  else if (price === "0.00") problems.price = "INVALID";

  const liveWeightKg = live ?? null;
  const carcassWeightKg = carcassBasis ? (carcass ?? null) : null;
  const valid = Object.keys(problems).length === 0;
  return {
    liveWeightKg,
    carcassWeightKg,
    price,
    adjusted,
    value: valid ? itemValue(pricing, { liveWeightKg, carcassWeightKg, unitPrice: price }) : null,
    awaitingCarcass: carcassBasis && carcassWeightKg === null,
    problems,
  };
}
