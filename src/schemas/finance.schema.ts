import { z } from "zod";

// ── Compra e venda ──
//
// Compra e venda têm exatamente a mesma forma (o produtor pensa em
// "peso × preço por kg" nos dois casos), mas são conceitos de domínio
// diferentes e podem divergir no futuro (ex.: exigir data de venda >= data
// de compra). Por isso ficam em schemas separados, não num schema genérico.
//
// Cada schema é usado tanto no cadastro (POST) quanto na edição (PUT): as
// regras são idênticas nos dois, então reaproveitar evita duplicação sem
// virar gambiarra.

export const purchaseSchema = z
  .object({
    date: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "A data não pode ser no futuro."),
    weightKg: z.coerce
      .number()
      .positive("O peso deve ser maior que zero."),
    pricePerKg: z.coerce
      .number()
      .positive("O preço por kg deve ser maior que zero."),
    notes: z.string().optional(),
  })
  .strict();

export const saleSchema = z
  .object({
    date: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "A data não pode ser no futuro."),
    weightKg: z.coerce
      .number()
      .positive("O peso deve ser maior que zero."),
    pricePerKg: z.coerce
      .number()
      .positive("O preço por kg deve ser maior que zero."),
    notes: z.string().optional(),
  })
  .strict();

export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type SaleInput = z.infer<typeof saleSchema>;

// ── Preço estimado ──
//
// Preço por kg que o PRODUTOR informa para um animal vivo (o sistema não
// chuta). `null` limpa a estimativa — o produtor pode ter digitado errado
// e querer apagar.

export const estimatedPriceSchema = z
  .object({
    pricePerKg: z.coerce
      .number()
      .positive("O preço por kg deve ser maior que zero.")
      .nullable(),
  })
  .strict();

export type EstimatedPriceInput = z.infer<typeof estimatedPriceSchema>;
