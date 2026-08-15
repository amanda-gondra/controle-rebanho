import { z } from "zod";

// The shape of a valid animal on creation. Nothing reaches the DB without passing here.
export const createAnimalSchema = z
  .object({
    tag: z.string().min(1, "Tag is required."),
    sex: z.enum(["MALE", "FEMALE"]),
    category: z.enum(["CALF", "YEARLING", "STEER", "COW"]),
    breed: z.string().min(1).optional(),
    birthDate: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "Birth date cannot be in the future.")
      .optional(),
    birthPrecision: z
      .enum(["DAY_MONTH_YEAR", "MONTH_YEAR", "UNKNOWN"])
      .default("UNKNOWN"),
    notes: z.string().optional(),
  })
  .strict();

// The TypeScript type comes from the schema itself: a single source of truth.
export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;

// Valida o parâmetro :id da URL (tem que ser um UUID válido)
export const animalIdParamSchema = z.object({
  id: z.string().uuid("ID inválido."),
});

// Valida os filtros opcionais da listagem (?status=...&category=...)
export const listAnimalsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "SOLD", "DEAD"]).optional(),
  category: z.enum(["CALF", "YEARLING", "STEER", "COW"]).optional(),
});

// Valida o corpo do PATCH de status (só aceita um status válido)
export const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SOLD", "DEAD"]),
});

// Valida a edição de um animal — todos os campos opcionais (menos a tag, que não se edita aqui)
export const updateAnimalSchema = z
  .object({
    sex: z.enum(["MALE", "FEMALE"]),
    category: z.enum(["CALF", "YEARLING", "STEER", "COW"]),
    breed: z.string().min(1),
    birthDate: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "Birth date cannot be in the future."),
    birthPrecision: z.enum(["DAY_MONTH_YEAR", "MONTH_YEAR", "UNKNOWN"]),
    notes: z.string(),
  })
  .partial()
  .strict();