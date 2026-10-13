import type { FastifyInstance } from "fastify";
import { assertAnimalsInHerdOnDate } from "../lib/animal-life.js";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { assertNotInFuture, toDbDate } from "../lib/dates.js";
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

const FUTURE_DATE = "A data não pode ser no futuro.";

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
      const product = await request.db.product.create({
        data: { ...request.body, farmId: request.auth.farm.id },
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
      return request.db.product.findMany({
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
      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);
      const farmId = request.auth.farm.id;

      // 1. confere se o produto existe
      const product = await request.db.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw productNotFound();

      // 2. confere se todos os animais existem (o schema já recusa ids repetidos)
      const found = await request.db.animal.count({
        where: { id: { in: animalIds } },
      });
      if (found !== animalIds.length) {
        throw badRequest(
          ErrorCode.ANIMALS_NOT_FOUND,
          "Um ou mais animais não foram encontrados.",
        );
      }

      // 2b. todos precisam estar no rebanho na data (nada depois da saída —
      // RN-ANIMAL-012 — nem antes do nascimento com dia certo)
      await assertAnimalsInHerdOnDate(request.db, animalIds, date);

      // 3. cria a aplicação (evento) JÁ com as ligações por animal.
      // As ligações são criação ANINHADA: o farmId vai explícito em cada uma.
      const application = await request.db.application.create({
        data: {
          farmId,
          productId,
          date: toDbDate(date),
          reapplyDate: reapplyDate ? toDbDate(reapplyDate) : null,
          notes,
          animals: {
            create: animalIds.map((animalId) => ({ animalId, farmId })),
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
      const applications = await request.db.application.findMany({
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

  // GET /alerts — reaplicações chegando (antecedência da fazenda, padrão 7 dias) e vencidas
  r.get(
    "/alerts",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Reaplicações chegando ou vencidas",
      },
    },
    async (request) => {
      const now = new Date();
      // fuso e antecedência são da fazenda logada (G2): mudar a configuração
      // muda a lista na hora, sem regravar nada (RN-CFG-006)
      const { timezone, settings } = request.auth.farm;

      // busca as que têm data de reaplicação (a regra de "é alerta" fica na função)
      const applications = await request.db.application.findMany({
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
          const { isAlert, overdue } = classifyReapplication(
            app,
            now,
            timezone,
            settings.reapplyAlertDays,
          );
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
      const application = await request.db.application.findUnique({
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
      const existing = await request.db.application.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) throw applicationNotFound();

      const { productId, date, reapplyDate, notes } = request.body;
      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);

      // mudar a data não pode deixar algum animal da aplicação fora do rebanho
      const links = await request.db.applicationAnimal.findMany({
        where: { applicationId: existing.id },
        select: { animalId: true },
      });
      await assertAnimalsInHerdOnDate(
        request.db,
        links.map((link) => link.animalId),
        date,
      );

      // confere se o produto novo existe
      const product = await request.db.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw productNotFound();

      const updated = await request.db.application.update({
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
      const { count } = await request.db.application.deleteMany({
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
      const animal = await request.db.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        throw notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");
      }
      const links = await request.db.applicationAnimal.findMany({
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