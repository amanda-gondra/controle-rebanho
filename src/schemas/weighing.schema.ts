import { z } from "zod";

// Valida o corpo ao registrar uma pesagem
export const createWeighingSchema = z
  .object({
    date: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "Weighing date cannot be in the future."),
    weightKg: z.coerce
      .number()
      .positive("Weight must be greater than zero."),
  })
  .strict();

export type CreateWeighingInput = z.infer<typeof createWeighingSchema>;

// Valida os parâmetros da URL quando a rota mexe numa pesagem específica
// (precisa do id do animal E do id da pesagem — a pesagem "pertence" ao animal)
export const weighingParamsSchema = z.object({
  id: z.string().uuid("ID do animal inválido."),
  weighingId: z.string().uuid("ID da pesagem inválido."),
});

// Valida o corpo ao editar uma pesagem (mesmas regras do cadastro)
export const updateWeighingSchema = z
  .object({
    date: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "Weighing date cannot be in the future."),
    weightKg: z.coerce
      .number()
      .positive("Weight must be greater than zero."),
  })
  .strict();