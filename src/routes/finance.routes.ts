import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ErrorCode, notFound } from "../lib/errors.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";
import { calculateAnimalResult } from "../services/finance.service.js";

// Resultado por animal (RN-NEG-012): venda − compra, sem custos.
// Compra e venda são registradas pelas negociações (routes/trades.routes.ts);
// as rotas antigas /animals/:id/purchase, /sale e /estimated-price saíram na
// G5 (o valor estimado ficou fora da 1.0 — D-09).
export async function financeRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /animals/:id/result — compra, venda e a diferença
  r.get(
    "/animals/:id/result",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Compra, venda e diferença venda − compra de um animal (sem custos)",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const animal = await request.db.animal.findUnique({
        where: { id: request.params.id },
        select: { id: true },
      });
      if (!animal) throw notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");
      return calculateAnimalResult(request.db, animal.id);
    },
  );
}
