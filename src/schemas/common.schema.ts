import { z } from "zod";

// Peças de validação reaproveitadas pelos schemas. Os limites são coerentes com
// as colunas do banco (F-14): um valor que o banco não guarda vira erro de
// validação (400), nunca erro interno (500).

// Limites das colunas Decimal do schema.prisma
const MAX_WEIGHT_KG = 9999.99; // Decimal(6, 2)
const MAX_PRICE_PER_KG = 99_999_999.99; // Decimal(10, 2)

// Limites de texto (técnicos: evitam abuso; ajustáveis se o produto pedir)
export const MAX_TAG_LENGTH = 50;
export const MAX_NAME_LENGTH = 100;
export const MAX_NOTES_LENGTH = 1000;

// No máximo 2 casas decimais (o banco arredondaria em silêncio)
const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

// "AAAA-MM-DD"
export const calendarDate = z.iso.date("Data inválida. Use o formato AAAA-MM-DD.");

// "Não pode ser no futuro" depende do fuso da fazenda logada, então é
// conferido na rota com assertNotInFuture (src/lib/dates.ts).

export const weightKg = z.coerce
  .number({ error: "O peso deve ser um número." })
  .positive("O peso deve ser maior que zero.")
  .max(MAX_WEIGHT_KG, `O peso não pode passar de ${MAX_WEIGHT_KG} kg.`)
  .refine(hasAtMostTwoDecimals, {
    message: "O peso aceita no máximo 2 casas decimais.",
    params: { code: "MAX_2_DECIMALS" },
  });

export const pricePerKg = z.coerce
  .number({ error: "O preço deve ser um número." })
  .positive("O preço por kg deve ser maior que zero.")
  .max(MAX_PRICE_PER_KG, "O preço por kg está acima do limite permitido.")
  .refine(hasAtMostTwoDecimals, {
    message: "O preço aceita no máximo 2 casas decimais.",
    params: { code: "MAX_2_DECIMALS" },
  });

// Texto obrigatório: tira espaços das pontas e exige pelo menos 1 caractere
export const requiredText = (max: number, requiredMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .max(max, `Use no máximo ${max} caracteres.`);

// Observações: texto livre com limite
export const notes = z
  .string()
  .trim()
  .max(MAX_NOTES_LENGTH, `Use no máximo ${MAX_NOTES_LENGTH} caracteres.`);
