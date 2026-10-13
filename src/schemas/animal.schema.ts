import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  MAX_TAG_LENGTH,
  notes,
  calendarDate,
  requiredText,
} from "./common.schema.js";
import { CATEGORIES } from "../lib/categories.js";

const sex = z.enum(["MALE", "FEMALE"]);
// Categorias da G4 (D-02). A combinação com o sexo é conferida na rota
// (resolveAnimalProfile), porque na edição depende do que o animal já tem.
const category = z.enum(CATEGORIES, "Categoria inválida.");
// Só para machos; na fêmea, mandar qualquer valor é recusado (RN-ANIMAL-006)
const castrated = z.boolean({ error: "Informe sim ou não." });
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
    castrated: castrated.optional(), // macho sem valor → padrão da fazenda
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

// Mudar situação (G5 — entrega 1, D-27). Ao sair (vendido/morto), a data de
// saída é obrigatória (conferida na rota, porque depende do status). Na morte,
// causa (opcional) e certeza (padrão "não informada"). Voltar para ativo apaga
// tudo isso.
export const MAX_DEATH_CAUSE_LENGTH = 200;

export const updateStatusSchema = z
  .object({
    status,
    exitDate: calendarDate.optional(),
    deathCause: z
      .string()
      .trim()
      .max(MAX_DEATH_CAUSE_LENGTH, `Use no máximo ${MAX_DEATH_CAUSE_LENGTH} caracteres.`)
      .nullable()
      .optional(),
    deathCauseCertainty: z.enum(["CONFIRMED", "SUSPECTED", "NOT_INFORMED"]).optional(),
  })
  .strict();

// Edição de um animal — todos os campos opcionais (a tag não se edita aqui).
// `null` LIMPA o campo (F-11): raça, observações e nascimento podem ser apagados.
export const updateAnimalSchema = z
  .object({
    sex,
    category,
    castrated,
    breed: breed.nullable(),
    birthDate: birthDate.nullable(),
    birthPrecision,
    notes: notes.nullable(),
  })
  .partial()
  .strict();

export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
