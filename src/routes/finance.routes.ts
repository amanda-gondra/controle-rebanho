import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";
import {
  purchaseSchema,
  saleSchema,
  estimatedPriceSchema,
} from "../schemas/finance.schema.js";
import { calculateAnimalResult } from "../services/finance.service.js";

export async function financeRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── COMPRA ──

  // POST /animals/:id/compra — registra a compra do animal (uma por animal)
  r.post(
    "/animals/:id/compra",
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
        include: { purchase: true },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal não encontrado." });
      }
      if (animal.purchase) {
        return reply
          .status(409)
          .send({ message: "Este animal já tem uma compra registrada." });
      }

      const { date, weightKg, pricePerKg, notes } = request.body;
      const purchase = await prisma.animalPurchase.create({
        data: {
          animalId: request.params.id,
          date: new Date(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
      return reply.status(201).send(purchase);
    },
  );

  // GET /animals/:id/compra — dados da compra
  r.get(
    "/animals/:id/compra",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Dados da compra de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const purchase = await prisma.animalPurchase.findUnique({
        where: { animalId: request.params.id },
      });
      if (!purchase) {
        return reply
          .status(404)
          .send({ message: "Nenhuma compra registrada para este animal." });
      }
      return purchase;
    },
  );

  // PUT /animals/:id/compra — edita a compra
  r.put(
    "/animals/:id/compra",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Edita a compra de um animal",
        params: animalIdParamSchema,
        body: purchaseSchema,
      },
    },
    async (request, reply) => {
      const purchase = await prisma.animalPurchase.findUnique({
        where: { animalId: request.params.id },
      });
      if (!purchase) {
        return reply
          .status(404)
          .send({ message: "Nenhuma compra registrada para este animal." });
      }

      const { date, weightKg, pricePerKg, notes } = request.body;
      const updated = await prisma.animalPurchase.update({
        where: { animalId: request.params.id },
        data: {
          date: new Date(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
      return updated;
    },
  );

  // DELETE /animals/:id/compra — exclui a compra
  r.delete(
    "/animals/:id/compra",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Exclui a compra de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const purchase = await prisma.animalPurchase.findUnique({
        where: { animalId: request.params.id },
      });
      if (!purchase) {
        return reply
          .status(404)
          .send({ message: "Nenhuma compra registrada para este animal." });
      }
      await prisma.animalPurchase.delete({
        where: { animalId: request.params.id },
      });
      return reply.status(204).send();
    },
  );

  // ── VENDA ──

  // POST /animals/:id/venda — registra a venda E marca o animal como SOLD.
  // Só bloqueia se o animal estiver morto (DEAD).
  r.post(
    "/animals/:id/venda",
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
        include: { sale: true },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal não encontrado." });
      }
      // Regra de negócio: um animal morto não é uma venda. Já um animal com
      // status SOLD (marcado na mão, ou vendido antes deste módulo existir)
      // ainda pode receber o registro de "por quanto foi vendido".
      if (animal.status === "DEAD") {
        return reply.status(409).send({
          message: "Não é possível registrar a venda de um animal marcado como morto.",
        });
      }
      if (animal.sale) {
        return reply
          .status(409)
          .send({ message: "Este animal já tem uma venda registrada." });
      }

      const { date, weightKg, pricePerKg, notes } = request.body;

      // A venda e a mudança de status andam juntas: ou as duas, ou nenhuma.
      const sale = await prisma.$transaction(async (tx) => {
        const created = await tx.animalSale.create({
          data: {
            animalId: request.params.id,
            date: new Date(date),
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

  // GET /animals/:id/venda — dados da venda
  r.get(
    "/animals/:id/venda",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Dados da venda de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const sale = await prisma.animalSale.findUnique({
        where: { animalId: request.params.id },
      });
      if (!sale) {
        return reply.status(404).send({ message: "Nenhuma venda registrada para este animal." });
      }
      return sale;
    },
  );

  // PUT /animals/:id/venda — edita a venda (não mexe no status: já está SOLD)
  r.put(
    "/animals/:id/venda",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Edita a venda de um animal",
        params: animalIdParamSchema,
        body: saleSchema,
      },
    },
    async (request, reply) => {
      const sale = await prisma.animalSale.findUnique({
        where: { animalId: request.params.id },
      });
      if (!sale) {
        return reply.status(404).send({ message: "Nenhuma venda registrada para este animal." });
      }

      const { date, weightKg, pricePerKg, notes } = request.body;
      const updated = await prisma.animalSale.update({
        where: { animalId: request.params.id },
        data: {
          date: new Date(date),
          weightKg,
          pricePerKg,
          notes: notes ?? null,
        },
      });
      return updated;
    },
  );

  // DELETE /animals/:id/venda — desfaz a venda E volta o animal para ACTIVE
  r.delete(
    "/animals/:id/venda",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Desfaz a venda de um animal e volta o status para ativo",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const sale = await prisma.animalSale.findUnique({
        where: { animalId: request.params.id },
      });
      if (!sale) {
        return reply.status(404).send({ message: "Nenhuma venda registrada para este animal." });
      }

      // Desfazer a venda e reativar o animal andam juntos.
      await prisma.$transaction(async (tx) => {
        await tx.animalSale.delete({
          where: { animalId: request.params.id },
        });
        await tx.animal.update({
          where: { id: request.params.id },
          data: { status: "ACTIVE" },
        });
      });

      return reply.status(204).send();
    },
  );

  // ── PREÇO ESTIMADO ──

  // PATCH /animals/:id/preco-estimado — o produtor informa (ou limpa) o preço/kg
  r.patch(
    "/animals/:id/preco-estimado",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Informa o preço/kg estimado de um animal vivo",
        params: animalIdParamSchema,
        body: estimatedPriceSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal não encontrado." });
      }
      const updated = await prisma.animal.update({
        where: { id: request.params.id },
        data: { estimatedPricePerKg: request.body.pricePerKg },
      });
      return updated;
    },
  );

  // ── RESULTADO ──

  // GET /animals/:id/resultado — resultado financeiro do animal (calculado)
  r.get(
    "/animals/:id/resultado",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Resultado financeiro de um animal (real ou estimado)",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal não encontrado." });
      }
      return calculateAnimalResult(request.params.id);
    },
  );
}
