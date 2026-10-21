import { z } from "zod";
import { MAX_NAME_LENGTH, calendarDate, notes, requiredText } from "./common.schema.js";
import { MAX_ANIMALS_PER_APPLICATION } from "./sanitary.schema.js";

// Lotes (D-49, versão simples): nome + descrição; animais entram e saem com data.

export const createLotSchema = z
  .object({
    name: requiredText(MAX_NAME_LENGTH, "O nome do lote é obrigatório."),
    description: notes.transform((value) => (value === "" ? null : value)).nullable().optional(),
  })
  .strict();

export const updateLotSchema = createLotSchema.partial().strict();

export const lotIdParamSchema = z.object({ id: z.uuid("Lote inválido.") });

export const listLotsQuerySchema = z
  .object({ includeArchived: z.enum(["true", "false"]).optional() })
  .strict();

// Mover animais (entrar no lote ou trocar de lote) — ou tirar do lote
export const lotMoveSchema = z
  .object({
    animalIds: z
      .array(z.uuid("Animal inválido."))
      .min(1, "Selecione pelo menos um animal.")
      .max(MAX_ANIMALS_PER_APPLICATION, `Selecione no máximo ${MAX_ANIMALS_PER_APPLICATION} animais.`)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "O mesmo animal foi selecionado mais de uma vez.",
        params: { code: "DUPLICATE_ITEMS" },
      }),
    date: calendarDate,
  })
  .strict();
