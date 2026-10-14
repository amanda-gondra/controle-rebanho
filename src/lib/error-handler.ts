import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError, ErrorCode, type FieldError } from "./errors.js";
import { issueToFieldErrors, type IssueLike } from "./validation-errors.js";

type ErrorBody = { code: ErrorCode; message: string; errors?: FieldError[] };

// Qual unicidade foi violada → qual código e mensagem devolver (F-12).
// A chave é "Modelo.campo1,campo2".
const DUPLICATE_MESSAGES: Record<string, { code: ErrorCode; message: string }> = {
  "Animal.farmId,tag": {
    code: ErrorCode.DUPLICATE_TAG,
    message: "Já existe um animal cadastrado com este brinco.",
  },
  "User.email": {
    code: ErrorCode.EMAIL_ALREADY_REGISTERED,
    message: "Já existe uma conta com esse e-mail.",
  },
  "Weighing.animalId,date": {
    code: ErrorCode.DUPLICATE_WEIGHING_DATE,
    message: "Este animal já tem uma pesagem nesse dia. Edite a pesagem existente.",
  },
};

// O Prisma informa os campos da unicidade violada em lugares diferentes,
// conforme o motor usado. Esta função lê os dois formatos conhecidos.
function uniqueFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = (error.meta ?? {}) as Record<string, unknown>;

  if (Array.isArray(meta.target)) {
    return meta.target.map(String);
  }

  const adapterError = meta.driverAdapterError as
    | { cause?: { constraint?: { fields?: unknown } } }
    | undefined;
  const fields = adapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) {
    return fields.map((field) => String(field).replace(/"/g, ""));
  }

  return [];
}

// Para as rotas que tratam uma unicidade do jeito delas (ex.: negociação
// repetida devolve a que já existe): os campos violados, se o erro for de
// unicidade NESSA tabela; senão null.
export function uniqueViolation(error: unknown, model: string): string[] | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const errorModel = String((error.meta as { modelName?: string })?.modelName ?? "");
  return errorModel === model ? uniqueFields(error) : null;
}

function prismaErrorResponse(
  error: Prisma.PrismaClientKnownRequestError,
): { status: number; body: ErrorBody } | null {
  switch (error.code) {
    case "P2002": {
      const model = String((error.meta as { modelName?: string })?.modelName ?? "");
      const key = `${model}.${uniqueFields(error).join(",")}`;
      const known = DUPLICATE_MESSAGES[key];
      return {
        status: 409,
        body: known ?? {
          code: ErrorCode.DUPLICATE_RECORD,
          message: "Este registro já existe.",
        },
      };
    }
    // Registro sumiu entre a verificação e a gravação (ex.: excluído ao mesmo tempo).
    case "P2025":
      return {
        status: 404,
        body: {
          code: ErrorCode.RECORD_NOT_FOUND,
          message: "Registro não encontrado.",
        },
      };
    // Chave estrangeira: aponta para algo que não existe (ou ainda está em uso).
    case "P2003":
      return {
        status: 409,
        body: {
          code: ErrorCode.RELATED_RECORD_NOT_FOUND,
          message: "Um registro relacionado não existe ou ainda está em uso.",
        },
      };
    default:
      return null;
  }
}

// Erros do próprio Fastify/plugins que já trazem um status 4xx
// (JSON malformado, corpo grande demais, limite de requisições...).
function clientErrorResponse(error: FastifyError): ErrorBody {
  switch (error.statusCode) {
    case 413:
      return { code: ErrorCode.PAYLOAD_TOO_LARGE, message: "Os dados enviados são grandes demais." };
    case 415:
      return { code: ErrorCode.UNSUPPORTED_MEDIA_TYPE, message: "Formato de dados não suportado." };
    case 429:
      return {
        code: ErrorCode.RATE_LIMITED,
        message: "Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.",
      };
    default:
      return { code: ErrorCode.BAD_REQUEST, message: "Requisição inválida." };
  }
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Erros previstos pelas regras da aplicação
  if (error instanceof AppError) {
    return reply
      .status(error.statusCode)
      .send({
        code: error.code,
        message: error.message,
        ...(error.errors ? { errors: error.errors } : {}),
      } satisfies ErrorBody);
  }

  // Validação automática (schemas Zod nas rotas) → 400
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Dados inválidos.",
      // Cada problema vira { field, code, params?, error } — G3
      errors: error.validation.flatMap((issue) => {
        const path = issue.instancePath.replace(/^\//, "").split("/").filter(Boolean);
        const input =
          error.validationContext === "querystring"
            ? request.query
            : error.validationContext === "params"
              ? request.params
              : request.body;
        return issueToFieldErrors(
          { ...(issue.params as object), code: issue.keyword, path, message: issue.message } as IssueLike,
          input,
        );
      }),
    } satisfies ErrorBody);
  }

  // Validação manual (.parse) — rede de segurança
  if (error instanceof ZodError) {
    return reply.status(400).send({
      code: ErrorCode.VALIDATION_ERROR,
      message: "Dados inválidos.",
      errors: error.issues.flatMap((issue) =>
        issueToFieldErrors(issue as unknown as IssueLike, request.body),
      ),
    } satisfies ErrorBody);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaErrorResponse(error);
    if (mapped) {
      return reply.status(mapped.status).send(mapped.body);
    }
  }

  // Erros 4xx do Fastify/plugins: antes viravam 500 por engano.
  if (
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return reply.status(error.statusCode).send(clientErrorResponse(error));
  }

  // Qualquer outra coisa: registra no log e responde genérico (sem vazar detalhe).
  request.log.error(error);
  return reply.status(500).send({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Erro interno do servidor.",
  } satisfies ErrorBody);
}
