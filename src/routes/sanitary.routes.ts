import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  applicationIdParamSchema,
} from "../schemas/sanitary.schema.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";

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
      const { productId, date, notes, animalIds } = request.body;

      // 1. confere se o produto existe
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        return reply.status(404).send({ message: "Product not found." });
      }

      // 2. confere se todos os animais existem
      const found = await prisma.animal.count({
        where: { id: { in: animalIds } },
      });
      if (found !== animalIds.length) {
        return reply
          .status(400)
          .send({ message: "One or more animals were not found." });
      }

      // 3. cria a aplicação (evento) JÁ com as ligações por animal
      const application = await prisma.application.create({
        data: {
          productId,
          date: new Date(date),
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
    async (request, reply) => {
      const application = await prisma.application.findUnique({
        where: { id: request.params.id },
        include: {
          product: true,
          animals: { include: { animal: true } },
        },
      });
      if (!application) {
        return reply.status(404).send({ message: "Application not found." });
      }
      return application;
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
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      // busca as ligações desse animal, trazendo a aplicação e o produto
      const links = await prisma.applicationAnimal.findMany({
        where: { animalId: request.params.id },
        include: {
          application: { include: { product: true } },
        },
        orderBy: { application: { date: "desc" } },
      });
      // devolve já "achatado": a aplicação + o produto de cada uma
      return links.map((link) => link.application);
    },
  );
}