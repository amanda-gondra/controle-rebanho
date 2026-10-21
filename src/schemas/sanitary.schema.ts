import { z } from "zod";
import {
  MAX_NAME_LENGTH,
  calendarDate,
  notes,
  requiredText,
} from "./common.schema.js";

// Quantos animais cabem em uma aplicação (limite técnico contra abuso;
// cobre o maior lote razoável de uma fazenda — ajustável se o produto pedir).
export const MAX_ANIMALS_PER_APPLICATION = 5000;

// D-39: vacina, vermífugo, antiparasitário externo e outro (remédio)
export const PRODUCT_TYPES = ["VACCINE", "DEWORMER", "EXTERNAL_PARASITICIDE", "OTHER"] as const;
const productType = z.enum(PRODUCT_TYPES, "Tipo de produto inválido.");

export const MAX_WITHDRAWAL_DAYS = 365;
export const MAX_PURPOSE_LENGTH = 200;
export const MAX_BATCH_LENGTH = 50;
export const MAX_DISMISS_REASON_LENGTH = 200;
const MAX_DOSE = 9_999_999.999; // Decimal(10, 3)

// Texto opcional que pode ser apagado (null limpa)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

// ── Produtos ──

// Carência em dias, da bula (D-12). Vazio/null = "não informada" (≠ 0).
const withdrawalDays = z
  .number({ error: "Informe a carência em dias inteiros." })
  .int("Informe a carência em dias inteiros.")
  .min(0, "A carência não pode ser negativa.")
  .max(MAX_WITHDRAWAL_DAYS, `A carência pode ter no máximo ${MAX_WITHDRAWAL_DAYS} dias.`)
  .nullable();

const productFields = {
  name: requiredText(MAX_NAME_LENGTH, "O nome do produto é obrigatório."),
  type: productType,
  purpose: optionalText(MAX_PURPOSE_LENGTH).optional(),
  manufacturer: optionalText(MAX_NAME_LENGTH).optional(),
  withdrawalDays: withdrawalDays.optional(),
  notes: notes.transform((value) => (value === "" ? null : value)).nullable().optional(),
};

export const createProductSchema = z.object(productFields).strict();

// Edição: todos opcionais (null limpa os opcionais)
export const updateProductSchema = z.object(productFields).partial().strict();

// Lista de produtos: por tipo; arquivados só se pedir (tela de Produtos)
export const listProductsQuerySchema = z
  .object({
    type: productType.optional(),
    includeArchived: z.enum(["true", "false"]).optional(),
  })
  .strict();

export const productIdParamSchema = z.object({
  id: z.uuid("ID do produto inválido."),
});

// ── Aplicações ──

// Dose aplicada (RN-SAN-013): número + unidade, juntos; nunca sugerida
const dose = {
  doseAmount: z
    .number({ error: "A dose deve ser um número." })
    .positive("A dose deve ser maior que zero.")
    .max(MAX_DOSE, "A dose está acima do limite permitido.")
    .refine((value) => Math.abs(Math.round(value * 1000) - value * 1000) < 1e-6, {
      message: "A dose aceita no máximo 3 casas decimais.",
      params: { code: "MAX_3_DECIMALS" },
    })
    .nullable()
    .optional(),
  doseUnit: z.enum(["ML", "G", "DOSE"], "Unidade da dose inválida.").nullable().optional(),
};

// Campos comuns ao cadastro e à edição de uma aplicação
const applicationFields = {
  productId: z.uuid("Produto inválido."),
  date: calendarDate,
  reapplyDate: calendarDate.nullable().optional(),
  notes: notes.optional(),
  batchNumber: optionalText(MAX_BATCH_LENGTH).optional(),
  ...dose,
};

const animalIds = z
  .array(z.uuid("Animal inválido."))
  .min(1, "Selecione pelo menos um animal.")
  .max(
    MAX_ANIMALS_PER_APPLICATION,
    `Selecione no máximo ${MAX_ANIMALS_PER_APPLICATION} animais por aplicação.`,
  )
  .refine(
    (ids) => new Set(ids).size === ids.length,
    { message: "O mesmo animal foi selecionado mais de uma vez.", params: { code: "DUPLICATE_ITEMS" } },
  );

// A reaplicação acontece DEPOIS da aplicação (comparação de "AAAA-MM-DD")
const reapplyAfterDate = (data: { date: string; reapplyDate?: string | null }) =>
  !data.reapplyDate || data.reapplyDate > data.date;

const reapplyAfterDateIssue = {
  message: "A data de reaplicação deve ser depois da data da aplicação.",
  path: ["reapplyDate"],
  params: { code: "REAPPLY_BEFORE_DATE" },
};

// Dose: número e unidade vêm juntos (ou nenhum dos dois)
const doseComplete = (data: { doseAmount?: number | null; doseUnit?: string | null }) =>
  (data.doseAmount == null) === (data.doseUnit == null);

const doseCompleteIssue = {
  message: "Informe a quantidade e a unidade da dose (ou deixe as duas em branco).",
  path: ["doseUnit"],
  params: { code: "DOSE_INCOMPLETE" },
};

// Registro de uma aplicação: produto, data, observação e os animais selecionados
export const createApplicationSchema = z
  .object({
    ...applicationFields,
    animalIds,
    // Reaplicação registrada a partir de um lembrete (D-40): o lembrete sai
    reappliesApplicationId: z.uuid("Aplicação de origem inválida.").optional(),
    // Mesmo identificador em toda tentativa da mesma tela (REQ-INT-02)
    idempotencyKey: z.uuid("Identificador de operação inválido.").optional(),
  })
  .strict()
  .refine(reapplyAfterDate, reapplyAfterDateIssue)
  .refine(doseComplete, doseCompleteIssue);

// Filtros ao listar aplicações (?type=&from=&to=&page=)
export const listApplicationsQuerySchema = z
  .object({
    type: productType.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

// Valida o :id de uma aplicação na URL
export const applicationIdParamSchema = z.object({
  id: z.uuid("ID da aplicação inválido."),
});

// Edição de uma aplicação: dados e, opcionalmente, os animais (RN-SAN-011)
export const updateApplicationSchema = z
  .object({ ...applicationFields, animalIds: animalIds.optional() })
  .strict()
  .refine(reapplyAfterDate, reapplyAfterDateIssue)
  .refine(doseComplete, doseCompleteIssue);

// Dispensar o lembrete (D-40): motivo opcional
export const dismissReminderSchema = z
  .object({ reason: optionalText(MAX_DISMISS_REASON_LENGTH).optional() })
  .strict();
