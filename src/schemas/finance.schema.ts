import { z } from "zod";
import { notes, pastOrTodayDate, pricePerKg, weightKg } from "./common.schema.js";

// ── Compra e venda ──
//
// Compra e venda têm exatamente a mesma forma (o produtor pensa em
// "peso × preço por kg" nos dois casos), mas são conceitos de domínio
// diferentes e podem divergir no futuro. Por isso ficam em schemas separados.
// O modelo definitivo (Trade/TradeItem) chega na parte G5.
//
// Cada schema é usado tanto no cadastro (POST) quanto na edição (PUT).

const tradeFields = {
  date: pastOrTodayDate("A data não pode ser no futuro."),
  weightKg,
  pricePerKg,
  notes: notes.optional(),
};

export const purchaseSchema = z.object(tradeFields).strict();

export const saleSchema = z.object(tradeFields).strict();

export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type SaleInput = z.infer<typeof saleSchema>;

// ── Preço estimado ──
//
// Preço por kg que o PRODUTOR informa para um animal vivo (o sistema não
// chuta). `null` limpa a estimativa.

export const estimatedPriceSchema = z
  .object({
    pricePerKg: pricePerKg.nullable(),
  })
  .strict();

export type EstimatedPriceInput = z.infer<typeof estimatedPriceSchema>;
