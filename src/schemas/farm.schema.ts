import { z } from "zod";
import { MAX_NAME_LENGTH, requiredText } from "./common.schema.js";
import {
  BRAZIL_TIME_ZONES,
  MAX_ARROBA_LIVE_FACTOR_KG,
  MAX_REAPPLY_ALERT_DAYS,
} from "../lib/farm.js";

// Configurações da fazenda (G2). Só os campos EDITÁVEIS na 1.0.
//
// `.strict()` recusa qualquer outro campo — inclusive `id`, `country`,
// `currency` e `weightUnit` (D-30: fixos na 1.0). Assim ninguém consegue
// "mandar" outra fazenda nem mudar o que ainda não é configurável.
// Todos os campos são opcionais (PATCH = muda só o que veio), mas precisa vir
// pelo menos um.

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

export const updateFarmSchema = z
  .object({
    name: requiredText(MAX_NAME_LENGTH, "O nome da fazenda é obrigatório."),
    timezone: z.enum(BRAZIL_TIME_ZONES, "Escolha um fuso horário do Brasil."),
    arrobaLiveFactorKg: z
      .number({ error: "O fator da arroba deve ser um número." })
      .positive("O fator da arroba deve ser maior que zero.")
      .max(
        MAX_ARROBA_LIVE_FACTOR_KG,
        `O fator da arroba pode ser no máximo ${MAX_ARROBA_LIVE_FACTOR_KG} kg.`,
      )
      .refine(hasAtMostTwoDecimals, "O fator da arroba aceita no máximo 2 casas decimais."),
    preferredPriceUnit: z.enum(
      ["PER_KG", "PER_ARROBA", "PER_HEAD"],
      "Escolha por kg, por arroba ou por cabeça.",
    ),
    reapplyAlertDays: z
      .number({ error: "A antecedência deve ser um número de dias." })
      .int("A antecedência deve ser um número inteiro de dias.")
      .min(0, "A antecedência não pode ser negativa.")
      .max(MAX_REAPPLY_ALERT_DAYS, `A antecedência pode ser no máximo ${MAX_REAPPLY_ALERT_DAYS} dias.`),
    defaultCastrated: z.boolean({ error: "Informe sim ou não." }),
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Envie pelo menos uma configuração para alterar.");

export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
