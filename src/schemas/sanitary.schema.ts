import { z } from "zod";

// ── Produtos ──

// Cadastro de produto (vacina/vermífugo): nome + tipo
export const createProductSchema = z
  .object({
    name: z.string().min(1, "O nome do produto é obrigatório."),
    type: z.enum(["VACCINE", "DEWORMER"]),
  })
  .strict();

// Filtro opcional ao listar produtos (?type=VACCINE)
export const listProductsQuerySchema = z.object({
  type: z.enum(["VACCINE", "DEWORMER"]).optional(),
});

// ── Aplicações ──

// Registro de uma aplicação: produto, data, observação e os animais selecionados
export const createApplicationSchema = z
  .object({
    productId: z.string().uuid("Produto inválido."),
    date: z
      .iso
      .date()
      .refine((d) => new Date(d) <= new Date(), "A data não pode ser no futuro."),
    notes: z.string().optional(),
    animalIds: z
      .array(z.string().uuid("Animal inválido."))
      .min(1, "Selecione pelo menos um animal."),
  })
  .strict();

// Filtro opcional ao listar aplicações (?type=VACCINE)
export const listApplicationsQuerySchema = z.object({
  type: z.enum(["VACCINE", "DEWORMER"]).optional(),
});

// Valida o :id de uma aplicação na URL
export const applicationIdParamSchema = z.object({
  id: z.string().uuid("ID da aplicação inválido."),
});