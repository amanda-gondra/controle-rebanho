import { z } from "zod";
import { MAX_NAME_LENGTH, requiredText } from "./common.schema.js";

// Senha: mínimo 8 caracteres (recomendação NIST) e máximo 128 (evita que um
// texto gigante seja usado para sobrecarregar o servidor no cálculo do hash).
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

// E-mail sempre em minúsculas e sem espaços nas pontas
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("E-mail inválido.").max(254, "E-mail longo demais."));

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(MAX_PASSWORD_LENGTH, `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);

// Criar conta: cria a fazenda e o usuário juntos (Brief 7)
export const registerSchema = z
  .object({
    farmName: requiredText(MAX_NAME_LENGTH, "O nome da fazenda é obrigatório."),
    name: requiredText(MAX_NAME_LENGTH, "Seu nome é obrigatório."),
    email,
    password,
  })
  .strict();

// Entrar: no login não validamos o tamanho da senha (só que veio algo),
// para não dar pista sobre a regra a quem tenta adivinhar.
export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, "Informe a senha.").max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
