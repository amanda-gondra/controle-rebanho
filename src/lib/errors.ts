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

  // conta e sessão (G1)
  UNAUTHENTICATED: "UNAUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",

  // animais e pesagens
  ANIMAL_NOT_FOUND: "ANIMAL_NOT_FOUND",
  DUPLICATE_TAG: "DUPLICATE_TAG",
  ANIMAL_HAS_TRANSACTIONS: "ANIMAL_HAS_TRANSACTIONS",
  ANIMAL_HAS_SALE: "ANIMAL_HAS_SALE",
  WEIGHING_NOT_FOUND: "WEIGHING_NOT_FOUND",
  INSUFFICIENT_WEIGHINGS: "INSUFFICIENT_WEIGHINGS",
  SAME_DAY_WEIGHINGS: "SAME_DAY_WEIGHINGS",

  // categorias (G4)
  CATEGORY_INCOMPATIBLE_WITH_SEX: "CATEGORY_INCOMPATIBLE_WITH_SEX",
  CASTRATED_ONLY_FOR_MALES: "CASTRATED_ONLY_FOR_MALES",
  DUPLICATE_CATEGORY_LABEL: "DUPLICATE_CATEGORY_LABEL",

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

// Erro de um campo. `code` é o contrato (o frontend traduz); `params` traz os
// números da regra; `error` é o texto em português para quem lê a API.
export type FieldError = {
  field: string;
  code: string;
  params?: Record<string, string | number | boolean>;
  error: string;
};

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly errors?: FieldError[],
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

export const unauthorized = (code: ErrorCode, message: string) =>
  new AppError(401, code, message);

// Erro de validação de UM campo, no mesmo formato da validação do Zod
// (usado quando a regra depende da fazenda, ex.: data futura no fuso dela).
export const fieldError = (field: string, code: string, error: string) =>
  new AppError(400, ErrorCode.VALIDATION_ERROR, "Dados inválidos.", [{ field, code, error }]);

// Erro de regra de negócio ligado a campos, com código PRÓPRIO (ex.: categoria
// que não combina com o sexo) — o frontend decide pelo código e mostra no campo.
export const ruleError = (code: ErrorCode, message: string, errors: FieldError[]) =>
  new AppError(400, code, message, errors);
