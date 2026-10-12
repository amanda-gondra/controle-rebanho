import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { toDbDate } from "../lib/dates.js";
import { ErrorCode, badRequest, notFound } from "../lib/errors.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  createApplicationSchema,
  updateApplicationSchema,
  listApplicationsQuerySchema,
  applicationIdParamSchema,
} from "../schemas/sanitary.schema.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";
import { classifyReapplication } from "../services/sanitary.service.js";

const productNotFound = () =>
  notFound(ErrorCode.PRODUCT_NOT_FOUND, "Produto não encontrado.");

const applicationNotFound = () =>
  notFound(ErrorCode.APPLICATION_NOT_FOUND, "Aplicação não encontrada.");

export async function sanitaryRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── PRODUTOS ──

  // POST /products — cadastra uma vacina ou vermífugo
  r.post(
    "/products",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Cadastra um produto (vacina/vermífugo)",
        body: createProductSchema,
      },
    },
    async (request, reply) => {
      const product = await prisma.product.create({
        data: request.body,
      });
      return reply.status(201).send(product);
    },
  );

  // GET /products — lista os produtos (filtro opcional por tipo)
  r.get(
    "/products",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Lista os produtos (com filtro por tipo)",
        querystring: listProductsQuerySchema,
      },
    },
    async (request) => {
      const { type } = request.query;
      return prisma.product.findMany({
        where: { type },
        orderBy: { name: "asc" },
      });
    },
  );

  // ── APLICAÇÕES ──

  // POST /applications — registra uma aplicação (em lote, guarda individual)
  r.post(
    "/applications",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Registra uma aplicação de vacina/vermífugo",
        body: createApplicationSchema,
      },
    },
    async (request, reply) => {
      const { productId, date, reapplyDate, notes, animalIds } = request.body;

      // 1. confere se o produto existe
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw productNotFound();

      // 2. confere se todos os animais existem (o schema já recusa ids repetidos)
      const found = await prisma.animal.count({
        where: { id: { in: animalIds } },
      });
      if (found !== animalIds.length) {
        throw badRequest(
          ErrorCode.ANIMALS_NOT_FOUND,
          "Um ou mais animais não foram encontrados.",
        );
      }

      // 3. cria a aplicação (evento) JÁ com as ligações por animal
      const application = await prisma.application.create({
        data: {
          productId,
          date: toDbDate(date),
          reapplyDate: reapplyDate ? toDbDate(reapplyDate) : null,
          notes,
          animals: {
            create: animalIds.map((animalId) => ({ animalId })),
          },
        },
        include: {
          product: true,
          animals: { include: { animal: true } },
        },
      });

      return reply.status(201).send(application);
    },
  );

  // GET /applications — histórico por evento (filtro opcional por tipo)
  r.get(
    "/applications",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Lista as aplicações (histórico por evento)",
        querystring: listApplicationsQuerySchema,
      },
    },
    async (request) => {
      const { type } = request.query;
      const applications = await prisma.application.findMany({
        where: type ? { product: { type } } : {},
        orderBy: { date: "desc" },
        include: {
          product: true,
          _count: { select: { animals: true } }, // quantos animais no evento
        },
      });
      return applications;
    },
  );

  // GET /alerts — reaplicações chegando (próximos 7 dias) e vencidas
  r.get(
    "/alerts",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Reaplicações chegando ou vencidas",
      },
    },
    async () => {
      const now = new Date();

      // busca as que têm data de reaplicação (a regra de "é alerta" fica na função)
      const applications = await prisma.application.findMany({
        where: { reapplyDate: { not: null } },
        orderBy: { reapplyDate: "asc" },
        include: {
          product: true,
          _count: { select: { animals: true } },
        },
      });

      // usa a função pura pra decidir quais são alerta e quais estão vencidas
      return applications
        .map((app) => {
          const { isAlert, overdue } = classifyReapplication(app, now);
          return { ...app, isAlert, overdue };
        })
        .filter((app) => app.isAlert)
        .map(({ isAlert, ...app }) => app); // tira o isAlert do resultado final
    },
  );

  // GET /applications/:id — detalhes de uma aplicação (com os animais do lote)
  r.get(
    "/applications/:id",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Detalhes de uma aplicação (com os animais)",
        params: applicationIdParamSchema,
      },
    },
    async (request) => {
      const application = await prisma.application.findUnique({
        where: { id: request.params.id },
        include: {
          product: true,
          animals: { include: { animal: true } },
        },
      });
      if (!application) throw applicationNotFound();
      return application;
    },
  );

  // PUT /applications/:id — edita os dados de uma aplicação (não os animais)
  r.put(
    "/applications/:id",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Edita os dados de uma aplicação",
        params: applicationIdParamSchema,
        body: updateApplicationSchema,
      },
    },
    async (request) => {
      // confere se a aplicação existe
      const existing = await prisma.application.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) throw applicationNotFound();

      const { productId, date, reapplyDate, notes } = request.body;

      // confere se o produto novo existe
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw productNotFound();

      const updated = await prisma.application.update({
        where: { id: request.params.id },
        data: {
          productId,
          date: toDbDate(date),
          reapplyDate: reapplyDate ? toDbDate(reapplyDate) : null,
          notes,
        },
        include: {
          product: true,
          animals: { include: { animal: true } },
        },
      });
      return updated;
    },
  );

  // DELETE /applications/:id — exclui uma aplicação
  r.delete(
    "/applications/:id",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Exclui uma aplicação",
        params: applicationIdParamSchema,
      },
    },
    async (request, reply) => {
      // as ligações (ApplicationAnimal) somem junto por causa do onDelete: Cascade
      const { count } = await prisma.application.deleteMany({
        where: { id: request.params.id },
      });
      if (count === 0) throw applicationNotFound();
      return reply.status(204).send();
    },
  );

  // GET /animals/:id/applications — histórico sanitário de UM animal (pra ficha)
  r.get(
    "/animals/:id/applications",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Histórico sanitário de um animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        throw notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");
      }
      const links = await prisma.applicationAnimal.findMany({
        where: { animalId: request.params.id },
        include: {
          application: { include: { product: true } },
        },
        orderBy: { application: { date: "desc" } },
      });
      return links.map((link) => link.application);
    },
  );
}