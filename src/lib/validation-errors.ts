import type { FieldError } from "./errors.js";

// Erros de validação com CÓDIGO por campo (G3 — "a API devolve códigos; o
// frontend traduz").
//
// Cada erro de campo sai como { field, code, params?, error }:
// - `code` (ex.: TOO_LONG) é o contrato — a tela traduz para o idioma da pessoa;
// - `params` traz os números da regra (ex.: { max: 100 }) para a frase;
// - `error` é o texto em português, só para quem lê a API (desenvolvedor).
//
// O Zod descreve o problema com um "issue". Aqui ele vira um dos códigos
// abaixo. Regras próprias (refine) informam o código em `params.code`.

export const FieldErrorCode = {
  REQUIRED: "REQUIRED",
  INVALID_TYPE: "INVALID_TYPE",
  TOO_SHORT: "TOO_SHORT", // texto curto demais { min }
  TOO_LONG: "TOO_LONG", // texto longo demais { max }
  TOO_SMALL: "TOO_SMALL", // número pequeno demais { min, inclusive }
  TOO_BIG: "TOO_BIG", // número grande demais { max, inclusive }
  TOO_FEW: "TOO_FEW", // lista com poucos itens { min }
  TOO_MANY: "TOO_MANY", // lista com itens demais { max }
  NOT_INTEGER: "NOT_INTEGER",
  MAX_2_DECIMALS: "MAX_2_DECIMALS",
  INVALID_FORMAT: "INVALID_FORMAT", // { format: "date" | "email" | "uuid" ... }
  INVALID_OPTION: "INVALID_OPTION",
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  DUPLICATE_ITEMS: "DUPLICATE_ITEMS",
  FUTURE_DATE: "FUTURE_DATE",
  REAPPLY_BEFORE_DATE: "REAPPLY_BEFORE_DATE",
  EMPTY_UPDATE: "EMPTY_UPDATE",
  INVALID: "INVALID",
} as const;

export type FieldErrorCode = (typeof FieldErrorCode)[keyof typeof FieldErrorCode];

// O que importa de um issue do Zod (vem do Zod direto ou do plugin do Fastify)
export type IssueLike = {
  code: string;
  path: (string | number)[];
  message?: string;
  [key: string]: unknown;
};

const num = (value: unknown) => (typeof value === "bigint" ? Number(value) : (value as number));

// Lê o valor enviado num caminho (para saber se o campo veio vazio)
function valueAt(input: unknown, path: (string | number)[]): unknown {
  let current = input;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

export function issueToFieldErrors(issue: IssueLike, input: unknown): FieldError[] {
  const field = issue.path.join(".");
  const error = issue.message ?? "Valor inválido.";
  const one = (code: FieldErrorCode, params?: FieldError["params"]): FieldError[] => [
    { field, code, ...(params ? { params } : {}), error },
  ];

  switch (issue.code) {
    case "invalid_type": {
      const value = valueAt(input, issue.path);
      if (value === undefined) return one("REQUIRED");
      if (issue.expected === "int" && typeof value === "number") return one("NOT_INTEGER");
      return one("INVALID_TYPE");
    }

    case "too_small": {
      const min = num(issue.minimum);
      if (issue.origin === "string") return one(min <= 1 ? "REQUIRED" : "TOO_SHORT", { min });
      if (issue.origin === "array" || issue.origin === "set") return one("TOO_FEW", { min });
      return one("TOO_SMALL", { min, inclusive: issue.inclusive !== false });
    }

    case "too_big": {
      const max = num(issue.maximum);
      if (issue.origin === "string") return one("TOO_LONG", { max });
      if (issue.origin === "array" || issue.origin === "set") return one("TOO_MANY", { max });
      return one("TOO_BIG", { max, inclusive: issue.inclusive !== false });
    }

    case "invalid_format":
      return one("INVALID_FORMAT", { format: String(issue.format ?? "") });

    case "invalid_value":
    case "invalid_union":
      // Lista de opções (enum) sem valor nenhum = campo não preenchido
      return one(valueAt(input, issue.path) === undefined ? "REQUIRED" : "INVALID_OPTION");

    case "not_multiple_of":
      return one(num(issue.divisor) === 1 ? "NOT_INTEGER" : "INVALID");

    case "unrecognized_keys": {
      const keys = Array.isArray(issue.keys) ? issue.keys.map(String) : [];
      return keys.map((key) => ({
        field: field ? `${field}.${key}` : key,
        code: "UNKNOWN_FIELD",
        error: "Campo não reconhecido.",
      }));
    }

    case "custom": {
      // refine(..., { params: { code: "MAX_2_DECIMALS" } })
      const params = issue.params as { code?: string } | undefined;
      const code = params?.code;
      return one(code && code in FieldErrorCode ? (code as FieldErrorCode) : "INVALID");
    }

    default:
      return one("INVALID");
  }
}
