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

const productType = z.enum(["VACCINE", "DEWORMER"]);

// ── Produtos ──

// Cadastro de produto (vacina/vermífugo): nome + tipo
export const createProductSchema = z
  .object({
    name: requiredText(MAX_NAME_LENGTH, "O nome do produto é obrigatório."),
    type: productType,
  })
  .strict();

// Filtro opcional ao listar produtos (?type=VACCINE)
export const listProductsQuerySchema = z
  .object({
    type: productType.optional(),
  })
  .strict();

// ── Aplicações ──

// Campos comuns ao cadastro e à edição de uma aplicação
const applicationFields = {
  productId: z.uuid("Produto inválido."),
  date: calendarDate,
  reapplyDate: calendarDate.optional(),
  notes: notes.optional(),
};

// A reaplicação acontece DEPOIS da aplicação (comparação de "AAAA-MM-DD")
const reapplyAfterDate = (data: { date: string; reapplyDate?: string }) =>
  !data.reapplyDate || data.reapplyDate > data.date;

const reapplyAfterDateIssue = {
  message: "A data de reaplicação deve ser depois da data da aplicação.",
  path: ["reapplyDate"],
};

// Registro de uma aplicação: produto, data, observação e os animais selecionados
export const createApplicationSchema = z
  .object({
    ...applicationFields,
    animalIds: z
      .array(z.uuid("Animal inválido."))
      .min(1, "Selecione pelo menos um animal.")
      .max(
        MAX_ANIMALS_PER_APPLICATION,
        `Selecione no máximo ${MAX_ANIMALS_PER_APPLICATION} animais por aplicação.`,
      )
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "O mesmo animal foi selecionado mais de uma vez.",
      ),
  })
  .strict()
  .refine(reapplyAfterDate, reapplyAfterDateIssue);

// Filtro opcional ao listar aplicações (?type=VACCINE)
export const listApplicationsQuerySchema = z
  .object({
    type: productType.optional(),
  })
  .strict();

// Valida o :id de uma aplicação na URL
export const applicationIdParamSchema = z.object({
  id: z.uuid("ID da aplicação inválido."),
});

// Valida a edição de uma aplicação (só os dados, não os animais)
export const updateApplicationSchema = z
  .object(applicationFields)
  .strict()
  .refine(reapplyAfterDate, reapplyAfterDateIssue);
