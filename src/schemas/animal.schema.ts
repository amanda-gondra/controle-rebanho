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
// D-52: de onde veio e quando entrou na fazenda (opcionais)
export const ANIMAL_ORIGINS = ["BORN_ON_FARM", "PURCHASED", "RECEIVED", "NOT_INFORMED"] as const;
const origin = z.enum(ANIMAL_ORIGINS, "Origem inválida.");
const entryDate = calendarDate;
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
    origin: origin.default("NOT_INFORMED"),
    entryDate: entryDate.optional(),
    notes: notes.optional(),
  })
  .strict();

// Animal novo dentro de uma compra em lote (G5 — D-36): só o que a linha da
// compra pede. As mesmas regras do cadastro (brinco, sexo × categoria, castrado).
export const newAnimalSchema = z
  .object({
    tag: requiredText(MAX_TAG_LENGTH, "O brinco é obrigatório."),
    sex,
    category,
    castrated: castrated.optional(),
    breed: breed.optional(),
  })
  .strict();

export type NewAnimalInput = z.infer<typeof newAnimalSchema>;

// The TypeScript type comes from the schema itself: a single source of truth.
export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;

// Valida o parâmetro :id da URL (tem que ser um UUID válido)
export const animalIdParamSchema = z.object({
  id: z.uuid("ID inválido."),
});

// Lista do rebanho (paginada no servidor — F-15/F-16):
// - q: busca por brinco (atual ou antigo — D-19), raça ou nome da categoria;
// - tag: brinco exato, sem diferenciar maiúsculas, atual ou antigo (pesagem
//   em sequência — Espec — Pesagens §8);
// - filtros, ordenação e página. pageSize até 5000: as telas de seleção
//   (aplicação, negociação) pedem a lista inteira dos ativos de uma vez.
export const MAX_LIST_PAGE_SIZE = 5000;

export const listAnimalsQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    tag: z.string().trim().min(1).max(MAX_TAG_LENGTH).optional(),
    status: status.optional(),
    category: category.optional(),
    sex: sex.optional(),
    lotId: z.union([z.uuid("Lote inválido."), z.literal("none")]).optional(),
    sortBy: z.enum(["tag", "createdAt"]).default("tag"),
    order: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_LIST_PAGE_SIZE).default(20),
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
    origin,
    entryDate: entryDate.nullable(),
    notes: notes.nullable(),
  })
  .partial()
  .strict();

// Troca de brinco (D-19, F-ANI-06): novo brinco + motivo + data
export const tagChangeSchema = z
  .object({
    newTag: requiredText(MAX_TAG_LENGTH, "O brinco é obrigatório."),
    reason: z.enum(["LOST", "DAMAGED", "TYPO", "OTHER"], "Escolha o motivo."),
    date: calendarDate,
  })
  .strict();

// Linha do tempo: paginada, mais recente primeiro
export const historyQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type UpdateAnimalInput = z.infer<typeof updateAnimalSchema>;
