import { z } from "zod";

// The shape of a valid animal on creation. Nothing reaches the DB without passing here.
export const createAnimalSchema = z
  .object({
    tag: z.string().min(1, "Tag is required."),
    sex: z.enum(["MALE", "FEMALE"]),
    category: z.enum(["CALF", "YEARLING", "STEER", "COW"]),
    breed: z.string().min(1).optional(),
    birthDate: z.coerce
      .date()
      .max(new Date(), "Birth date cannot be in the future.")
      .optional(),
    birthPrecision: z
      .enum(["DAY_MONTH_YEAR", "MONTH_YEAR", "UNKNOWN"])
      .default("UNKNOWN"),
    notes: z.string().optional(),
  })
  .strict();

// The TypeScript type comes from the schema itself: a single source of truth.
export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;