import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_TAG_LENGTH,
  notes,
  calendarDate,
  requiredText,
} from "./common.schema.js";

const sex = z.enum(["MALE", "FEMALE"]);
// As categorias mudam na parte G4 (D-02); aqui ficam as atuais do banco.
const category = z.enum(["CALF", "YEARLING", "STEER", "COW"]);
const status = z.enum(["ACTIVE", "SOLD", "DEAD"]);
const birthPrecision = z.enum(["DAY_MONTH_YEAR", "MONTH_YEAR", "UNKNOWN"]);

const birthDate = calendarDate;
const breed = requiredText(MAX_NAME_LENGTH, "A raça não pode ficar em branco.");

// The shape of a valid animal on creation. Nothing reaches the DB without passing here.
export const createAnimalSchema = z
  .object({
    // F-13: espaços nas pontas são removidos (" BR-001" vira "BR-001")
    tag: requiredText(MAX_TAG_LENGTH, "O brinco é obrigatório."),
    sex,
    category,
    breed: breed.optional(),
    birthDate: birthDate.optional(),
    birthPrecision: birthPrecision.default("UNKNOWN"),
    notes: notes.optional(),
  })
  .strict();

// The TypeScript type comes from the schema itself: a single source of truth.
export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;

// Valida o parâmetro :id da URL (tem que ser um UUID válido)
export const animalIdParamSchema = z.object({
  id: z.uuid("ID inválido."),
});

// Valida os filtros e a ordenação da listagem (?status=&category=&sortBy=&order=)
export const listAnimalsQuerySchema = z
  .object({
    status: status.optional(),
    category: category.optional(),
    sortBy: z.enum(["tag", "createdAt"]).default("tag"),
    order: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

// Valida o corpo do PATCH de status (só aceita um status válido)
export const updateStatusSchema = z
  .object({
    status,
  })
  .strict();

// Edição de um animal — todos os campos opcionais (a tag não se edita aqui).
// `null` LIMPA o campo (F-11): raça, observações e nascimento podem ser apagados.
export const updateAnimalSchema = z
  .object({
    sex,
    category,
    breed: breed.nullable(),
    birthDate: birthDate.nullable(),
    birthPrecision,
    notes: notes.nullable(),
  })
  .partial()
  .strict();

export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
