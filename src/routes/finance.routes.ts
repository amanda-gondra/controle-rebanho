import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { calendarDateOf, toDbDate } from "../lib/dates.js";
import {
  ErrorCode,
  conflict,
  notFound,
  unprocessable,
} from "../lib/errors.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";
import {
  purchaseSchema,
  saleSchema,
  estimatedPriceSchema,
} from "../schemas/finance.schema.js";
import { calculateAnimalResult } from "../services/finance.service.js";

const animalNotFound = () =>
  notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");

const purchaseNotFound = () =>
  notFound(
    ErrorCode.PURCHASE_NOT_FOUND,
    "Nenhuma compra registrada para este animal.",
  );

const saleNotFound = () =>
  notFound(ErrorCode.SALE_NOT_FOUND, "Nenhuma venda registrada para este animal.");

// D-06: a venda não pode ser anterior à compra.
function assertSaleNotBeforePurchase(saleDate: string, purchaseDate: string) {
  if (saleDate < purchaseDate) {
    throw unprocessable(
      ErrorCode.SALE_BEFORE_PURCHASE,
      "A data da venda não pode ser anterior à data da compra.",
    );
  }
}

export async function financeRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── COMPRA ──

  // POST /animals/:id/purchase — registra a compra do animal (uma por animal)
  r.post(
    "/animals/:id/purchase",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Registra a compra de um animal (peso + preço/kg)",
        params: animalIdParamSchema,
        body: purchaseSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
        include: { purchase: true, sale: true },
      });
      if (!animal) throw animalNotFound();
      if (animal.purchase) {
        throw conflict(
          ErrorCode.DUPLICATE_PURCHASE,
          "Este animal já tem uma compra registrada.",
        );
      }

      const { date, weightKg, pricePerKg, notes } = request.body;
      if (animal.sale) {
        assertSaleNotBeforePurchase(calendarDateOf(animal.sale.date), date);
      }

      // Se duas requisições chegarem juntas, a unicidade do banco (animalId)
      // barra a segunda, e o tratador central responde DUPLICATE_PURCHASE.
      const purchase = await prisma.animalPurchase.create({
        data: {
          animalId: request.params.id,
          date: toDbDate(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
      return reply.status(201).send(purchase);
    },
  );

  // GET /animals/:id/purchase — dados da compra
  r.get(
    "/animals/:id/purchase",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Dados da compra de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const purchase = await prisma.animalPurchase.findUnique({
        where: { animalId: request.params.id },
      });
      if (!purchase) throw purchaseNotFound();
      return purchase;
    },
  );

  // PUT /animals/:id/purchase — edita a compra
  r.put(
    "/animals/:id/purchase",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Edita a compra de um animal",
        params: animalIdParamSchema,
        body: purchaseSchema,
      },
    },
    async (request) => {
      const purchase = await prisma.animalPurchase.findUnique({
        where: { animalId: request.params.id },
        include: { animal: { include: { sale: true } } },
      });
      if (!purchase) throw purchaseNotFound();

      const { date, weightKg, pricePerKg, notes } = request.body;
      if (purchase.animal.sale) {
        assertSaleNotBeforePurchase(calendarDateOf(purchase.animal.sale.date), date);
      }

      return prisma.animalPurchase.update({
        where: { animalId: request.params.id },
        data: {
          date: toDbDate(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
    },
  );

  // DELETE /animals/:id/purchase — exclui a compra
  r.delete(
    "/animals/:id/purchase",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Exclui a compra de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const { count } = await prisma.animalPurchase.deleteMany({
        where: { animalId: request.params.id },
      });
      if (count === 0) throw purchaseNotFound();
      return reply.status(204).send();
    },
  );

  // ── VENDA ──

  // POST /animals/:id/sale — registra a venda E marca o animal como SOLD.
  // Animal morto não recebe venda (D-06).
  r.post(
    "/animals/:id/sale",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Registra a venda de um animal (peso + preço/kg) e marca como vendido",
        params: animalIdParamSchema,
        body: saleSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
        include: { purchase: true, sale: true },
      });
      if (!animal) throw animalNotFound();

      // Um animal morto não é uma venda. Já um animal com status SOLD (marcado
      // na mão) ainda pode receber o registro de "por quanto foi vendido".
      if (animal.status === "DEAD") {
        throw conflict(
          ErrorCode.DEAD_ANIMAL_CANNOT_BE_SOLD,
          "Não é possível registrar a venda de um animal marcado como morto.",
        );
      }
      if (animal.sale) {
        throw conflict(
          ErrorCode.DUPLICATE_SALE,
          "Este animal já tem uma venda registrada.",
        );
      }

      const { date, weightKg, pricePerKg, notes } = request.body;
      if (animal.purchase) {
        assertSaleNotBeforePurchase(date, calendarDateOf(animal.purchase.date));
      }

      // A venda e a mudança de status andam juntas: ou as duas, ou nenhuma.
      const sale = await prisma.$transaction(async (tx) => {
        const created = await tx.animalSale.create({
          data: {
            animalId: request.params.id,
            date: toDbDate(date),
            weightKg,
            pricePerKg,
            notes: notes ?? null,
          },
        });
        await tx.animal.update({
          where: { id: request.params.id },
          data: { status: "SOLD" },
        });
        return created;
      });

      return reply.status(201).send(sale);
    },
  );

  // GET /animals/:id/sale — dados da venda
  r.get(
    "/animals/:id/sale",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Dados da venda de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const sale = await prisma.animalSale.findUnique({
        where: { animalId: request.params.id },
      });
      if (!sale) throw saleNotFound();
      return sale;
    },
  );

  // PUT /animals/:id/sale — edita a venda (não mexe no status: já está SOLD)
  r.put(
    "/animals/:id/sale",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Edita a venda de um animal",
        params: animalIdParamSchema,
        body: saleSchema,
      },
    },
    async (request) => {
      const sale = await prisma.animalSale.findUnique({
        where: { animalId: request.params.id },
        include: { animal: { include: { purchase: true } } },
      });
      if (!sale) throw saleNotFound();

      const { date, weightKg, pricePerKg, notes } = request.body;
      if (sale.animal.purchase) {
        assertSaleNotBeforePurchase(date, calendarDateOf(sale.animal.purchase.date));
      }

      return prisma.animalSale.update({
        where: { animalId: request.params.id },
        data: {
          date: toDbDate(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
    },
  );

  // DELETE /animals/:id/sale — desfaz a venda E volta o animal para ACTIVE
  r.delete(
    "/animals/:id/sale",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Desfaz a venda de um animal e volta o status para ativo",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      // Desfazer a venda e reativar o animal andam juntos.
      await prisma.$transaction(async (tx) => {
        const { count } = await tx.animalSale.deleteMany({
          where: { animalId: request.params.id },
        });
        if (count === 0) throw saleNotFound();

        await tx.animal.update({
          where: { id: request.params.id },
          data: { status: "ACTIVE" },
        });
      });

      return reply.status(204).send();
    },
  );

  // ── PREÇO ESTIMADO ──

  // PATCH /animals/:id/estimated-price — o produtor informa (ou limpa) o preço/kg
  r.patch(
    "/animals/:id/estimated-price",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Informa o preço/kg estimado de um animal vivo",
        params: animalIdParamSchema,
        body: estimatedPriceSchema,
      },
    },
    async (request) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) throw animalNotFound();

      return prisma.animal.update({
        where: { id: request.params.id },
        data: { estimatedPricePerKg: request.body.pricePerKg },
      });
    },
  );

  // ── RESULTADO ──

  // GET /animals/:id/result — resultado financeiro do animal (calculado)
  r.get(
    "/animals/:id/result",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Resultado financeiro de um animal (real ou estimado)",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) throw animalNotFound();
      return calculateAnimalResult(request.params.id);
    },
  );
}
