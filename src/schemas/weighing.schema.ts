import { z } from "zod";

// Valida o corpo ao registrar uma pesagem
export const createWeighingSchema = z
  .object({
    date: z.coerce
      .date()
      .max(new Date(), "Weighing date cannot be in the future."),
    weightKg: z.coerce
      .number()
      .positive("Weight must be greater than zero."),
  })
  .strict();

export type CreateWeighingInput = z.infer<typeof createWeighingSchema>;