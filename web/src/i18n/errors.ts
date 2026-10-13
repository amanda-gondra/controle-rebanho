import { t, tOptional, type MessageKey } from "./index.js";

// Erros da API → frase no idioma da pessoa (G3).
//
// A API responde { code, message, errors? }. A tela NUNCA mostra o `message`
// (texto para desenvolvedor, em português): decide sempre pelo `code`.
// Erro de campo: { field, code, params? } → errors.fieldCodes.<code>.

type FieldErrorLike = { field: string; code?: string; params?: Record<string, unknown> };

type ApiErrorLike = {
  status?: number;
  code?: string;
  errors?: FieldErrorLike[];
};

const asApiError = (err: unknown): ApiErrorLike =>
  err && typeof err === "object" ? (err as ApiErrorLike) : {};

// Mensagem geral de um erro (rodapé do formulário, aviso, toast)
export function errorMessage(err: unknown, fallback: MessageKey = "errors.generic"): string {
  const error = asApiError(err);
  // Sem resposta do servidor (sem internet, servidor desligado)
  if (error.status === undefined) return t("errors.network");
  const known = error.code ? tOptional(`errors.codes.${error.code}`) : undefined;
  if (known) return known;
  if (error.status >= 500) return t("errors.server");
  return t(fallback);
}

// Frase de um erro de campo, com os números da regra (ex.: { max: 100 })
export function fieldErrorMessage(fieldError: FieldErrorLike): string {
  const params = Object.fromEntries(
    Object.entries(fieldError.params ?? {}).map(([key, value]) => [key, String(value)]),
  );
  const code = fieldError.code ?? "INVALID";

  // "maior que zero" lê melhor que "maior que 0 (exclusivo)"
  if (code === "TOO_SMALL" && Number(params.min) === 0 && params.inclusive === "false") {
    return t("errors.fieldCodes.MUST_BE_POSITIVE");
  }
  if (code === "INVALID_FORMAT") {
    return tOptional(`errors.formats.${params.format}`) ?? t("errors.fieldCodes.INVALID");
  }
  return (
    tOptional(`errors.fieldCodes.${code}`, params) ??
    tOptional(`errors.codes.${code}`) ??
    t("errors.fieldCodes.INVALID")
  );
}

// Erros de campo da resposta → { campo: frase } (para mostrar em cada campo)
export function fieldErrorsOf(err: unknown): Record<string, string> | null {
  const { errors } = asApiError(err);
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const mapped: Record<string, string> = {};
  for (const fieldError of errors) {
    mapped[fieldError.field || "geral"] ??= fieldErrorMessage(fieldError);
  }
  return mapped;
}

// Uma frase só (para telas com um único lugar de erro, como as janelinhas):
// o primeiro erro de campo, se houver; senão a mensagem geral.
export function singleErrorMessage(err: unknown, fallback: MessageKey = "errors.generic"): string {
  const fields = fieldErrorsOf(err);
  return fields ? Object.values(fields)[0] : errorMessage(err, fallback);
}
