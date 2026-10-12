// Erros da aplicação com CÓDIGO estável (regra transversal 7 do escopo).
//
// A API sempre responde erros no formato { code, message, errors? }:
// - `code` é estável e é o que o frontend deve usar para decidir o que mostrar;
// - `message` é um texto em português, para quem lê a resposta (e para as telas
//   atuais, enquanto os textos não saem do código — parte G3).

export const ErrorCode = {
  // genéricos
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  ROUTE_NOT_FOUND: "ROUTE_NOT_FOUND",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  RATE_LIMITED: "RATE_LIMITED",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  RELATED_RECORD_NOT_FOUND: "RELATED_RECORD_NOT_FOUND",
  DUPLICATE_RECORD: "DUPLICATE_RECORD",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // animais e pesagens
  ANIMAL_NOT_FOUND: "ANIMAL_NOT_FOUND",
  DUPLICATE_TAG: "DUPLICATE_TAG",
  ANIMAL_HAS_TRANSACTIONS: "ANIMAL_HAS_TRANSACTIONS",
  ANIMAL_HAS_SALE: "ANIMAL_HAS_SALE",
  WEIGHING_NOT_FOUND: "WEIGHING_NOT_FOUND",
  INSUFFICIENT_WEIGHINGS: "INSUFFICIENT_WEIGHINGS",
  SAME_DAY_WEIGHINGS: "SAME_DAY_WEIGHINGS",

  // sanitário
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  APPLICATION_NOT_FOUND: "APPLICATION_NOT_FOUND",
  ANIMALS_NOT_FOUND: "ANIMALS_NOT_FOUND",

  // financeiro
  PURCHASE_NOT_FOUND: "PURCHASE_NOT_FOUND",
  SALE_NOT_FOUND: "SALE_NOT_FOUND",
  DUPLICATE_PURCHASE: "DUPLICATE_PURCHASE",
  DUPLICATE_SALE: "DUPLICATE_SALE",
  DEAD_ANIMAL_CANNOT_BE_SOLD: "DEAD_ANIMAL_CANNOT_BE_SOLD",
  SALE_BEFORE_PURCHASE: "SALE_BEFORE_PURCHASE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type FieldError = { field: string; error: string };

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Atalhos para os casos mais comuns — deixam as rotas curtas e legíveis.
export const notFound = (code: ErrorCode, message: string) =>
  new AppError(404, code, message);

export const conflict = (code: ErrorCode, message: string) =>
  new AppError(409, code, message);

export const unprocessable = (code: ErrorCode, message: string) =>
  new AppError(422, code, message);

export const badRequest = (code: ErrorCode, message: string) =>
  new AppError(400, code, message);
