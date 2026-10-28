import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Separação por fazenda — o "ponto único" (regra transversal 6).
//
// `forFarm(farmId)` devolve um acesso ao banco que coloca o farmId da SESSÃO
// em toda consulta e gravação das tabelas do rebanho:
//   - leituras, edições e exclusões ganham `where.farmId`;
//   - criações ganham `data.farmId`.
// Assim, uma rota não consegue ler nem alterar dado de outra fazenda, mesmo que
// alguém troque o id na URL: o registro simplesmente "não existe" (404).
//
// Atenção: criações ANINHADAS (ex.: aplicação + animais da aplicação) precisam
// informar o farmId do filho explicitamente — o filtro não entra em escritas
// aninhadas. As rotas fazem isso, e os testes de acesso cruzado conferem.

const TENANT_MODELS = new Set<string>([
  "Animal",
  "Weighing",
  "Product",
  "Application",
  "ApplicationAnimal",
  "Trade",
  "TradeItem",
  "AnimalEvent",
  "AuditLog",
  "Lot",
  "LotMembership",
]);

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

function scopeArgs(operation: string, rawArgs: unknown, farmId: string): Args {
  const args = { ...(rawArgs as Args) };

  if (WHERE_OPERATIONS.has(operation)) {
    args.where = { ...args.where, farmId };
  } else if (operation === "create") {
    args.data = { ...(args.data as Record<string, unknown>), farmId };
  } else if (operation === "createMany" || operation === "createManyAndReturn") {
    const data = args.data as Record<string, unknown> | Record<string, unknown>[];
    args.data = Array.isArray(data)
      ? data.map((row) => ({ ...row, farmId }))
      : { ...data, farmId };
  } else if (operation === "upsert") {
    args.where = { ...args.where, farmId };
    args.create = { ...args.create, farmId };
  } else {
    // Operação nova que este filtro não conhece: falha em vez de vazar dados.
    throw new Error(`Operação "${operation}" sem filtro de fazenda.`);
  }

  return args;
}

export function forFarm(farmId: string) {
  return prisma.$extends(
    Prisma.defineExtension({
      name: "farm-scope",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_MODELS.has(model)) {
              return query(args);
            }
            return query(scopeArgs(operation, args, farmId) as typeof args);
          },
        },
      },
    }),
  );
}

export type FarmDb = ReturnType<typeof forFarm>;
