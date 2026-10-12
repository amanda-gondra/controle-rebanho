import { z } from "zod";
import { pastOrTodayDate, weightKg } from "./common.schema.js";

// Valida o corpo ao registrar ou editar uma pesagem (mesmas regras nos dois casos)
export const weighingBodySchema = z
  .object({
    date: pastOrTodayDate("A data da pesagem não pode ser no futuro."),
    weightKg,
  })
  .strict();

export type WeighingBodyInput = z.infer<typeof weighingBodySchema>;

// Valida os parâmetros da URL quando a rota mexe numa pesagem específica
// (precisa do id do animal E do id da pesagem — a pesagem "pertence" ao animal)
export const weighingParamsSchema = z.object({
  id: z.uuid("ID do animal inválido."),
  weighingId: z.uuid("ID da pesagem inválido."),
});
