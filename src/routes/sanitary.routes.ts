import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "@prisma/client";
import { assertAnimalsInHerdOnDate } from "../lib/animal-life.js";
import { assertNotInFuture, calendarDateOf, toDbDate, todayInTimeZone } from "../lib/dates.js";
import { ErrorCode, badRequest, conflict, notFound } from "../lib/errors.js";
import { uniqueViolation } from "../lib/error-handler.js";
import { AuditAction, actorOf, recordAudit } from "../lib/history.js";
import type { FarmDb } from "../lib/tenant.js";
import { openReminders } from "../lib/reminders.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  createApplicationSchema,
  updateApplicationSchema,
  listApplicationsQuerySchema,
  applicationIdParamSchema,
  dismissReminderSchema,
} from "../schemas/sanitary.schema.js";
import { animalIdParamSchema } from "../schemas/animal.schema.js";
import { classifyReapplication, isReminderOpen, withdrawalEndDate } from "../services/sanitary.service.js";

// Manejo sanitário (Espec — Manejo sanitário v1.0). O sistema registra e
// lembra; não diagnostica, não prescreve, não sugere dose nem intervalo
// (RN-SAN-001). "Aplica em lote, guarda individual" (RN-SAN-002).

const productNotFound = () => notFound(ErrorCode.PRODUCT_NOT_FOUND, "Produto não encontrado.");
const applicationNotFound = () => notFound(ErrorCode.APPLICATION_NOT_FOUND, "Aplicação não encontrada.");
const duplicateProductName = () => conflict(ErrorCode.DUPLICATE_PRODUCT_NAME, "Já existe um produto com esse nome.");
const productArchived = () =>
  conflict(ErrorCode.PRODUCT_ARCHIVED, "Este produto está arquivado. Reative-o em Produtos para usar.");

const FUTURE_DATE = "A data não pode ser no futuro.";

const APPLICATION_INCLUDE = {
  product: true,
  animals: { include: { animal: true } },
} as const;

// Nome único na fazenda sem diferenciar maiúsculas (RN-SAN-005); o índice
// (farmId, lower(name)) garante de novo no banco
async function assertProductNameAvailable(db: Pick<FarmDb, "product">, name: string, exceptId?: string) {
  const taken = await db.product.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw duplicateProductName();
}

// Todos os animais existem nesta fazenda? (o schema já recusa ids repetidos)
async function assertAnimalsExist(db: FarmDb, animalIds: string[]) {
  const found = await db.animal.count({ where: { id: { in: animalIds } } });
  if (found !== animalIds.length) {
    throw badRequest(ErrorCode.ANIMALS_NOT_FOUND, "Um ou mais animais não foram encontrados.");
  }
}

// Carência copiada do produto no dia (RN-SAN-009)
const withdrawalOf = (date: string, days: number | null) => {
  const end = withdrawalEndDate(date, days);
  return { withdrawalDays: days, withdrawalEndDate: end ? toDbDate(end) : null };
};

const decimalOrNull = (value: number | null | undefined) =>
  value === null || value === undefined ? null : new Prisma.Decimal(value);

const withUsage = <T extends { _count: { applications: number } }>({ _count, ...product }: T) => ({
  ...product,
  usageCount: _count.applications,
});

export async function sanitaryRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ── PRODUTOS ──

  r.post(
    "/products",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Cadastra um produto sanitário (vacina, vermífugo, antiparasitário externo, outro)",
        body: createProductSchema,
      },
    },
    async (request, reply) => {
      await assertProductNameAvailable(request.db, request.body.name);
      const product = await request.db.product.create({
        data: { ...request.body, farmId: request.auth.farm.id },
      });
      return reply.status(201).send({ ...product, usageCount: 0 });
    },
  );

  // GET /products — ativos por padrão (seleção da aplicação); com
  // includeArchived=true, todos (tela de Produtos). Traz quantas vezes foi usado.
  r.get(
    "/products",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Lista os produtos (filtro por tipo; arquivados só se pedir)",
        querystring: listProductsQuerySchema,
      },
    },
    async (request) => {
      const { type, includeArchived } = request.query;
      const products = await request.db.product.findMany({
        where: { type, ...(includeArchived === "true" ? {} : { archivedAt: null }) },
        orderBy: { name: "asc" },
        include: { _count: { select: { applications: true } } },
      });
      return products.map(withUsage);
    },
  );

  // PUT /products/:id — edita (F-18). Mudar a carência NÃO altera aplicações
  // antigas: cada uma guardou a sua (RN-SAN-009, critério 12).
  r.put(
    "/products/:id",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Edita um produto",
        params: productIdParamSchema,
        body: updateProductSchema,
      },
    },
    async (request) => {
      const existing = await request.db.product.findUnique({ where: { id: request.params.id } });
      if (!existing) throw productNotFound();
      if (request.body.name !== undefined) {
        await assertProductNameAvailable(request.db, request.body.name, existing.id);
      }
      const product = await request.db.product.update({
        where: { id: existing.id },
        data: request.body,
        include: { _count: { select: { applications: true } } },
      });
      return withUsage(product);
    },
  );

  // Arquivar / reativar: some da seleção, o histórico continua (RN-SAN-005)
  for (const [path, archived] of [
    ["/products/:id/archive", true],
    ["/products/:id/unarchive", false],
  ] as const) {
    r.patch(
      path,
      {
        schema: {
          tags: ["Produtos"],
          summary: archived ? "Arquiva um produto" : "Reativa um produto arquivado",
          params: productIdParamSchema,
        },
      },
      async (request) => {
        const actor = actorOf(request.auth);
        const product = await request.db.$transaction(async (tx) => {
          const found = await tx.product.findUnique({ where: { id: request.params.id } });
          if (!found) return null;
          const updated = await tx.product.update({
            where: { id: found.id },
            data: { archivedAt: archived ? (found.archivedAt ?? new Date()) : null },
            include: { _count: { select: { applications: true } } },
          });
          if (Boolean(found.archivedAt) !== archived) {
            await recordAudit(tx, actor, {
              action: archived ? AuditAction.PRODUCT_ARCHIVED : AuditAction.PRODUCT_RESTORED,
              entityType: "Product",
              entityId: found.id,
              details: { name: found.name },
            });
          }
          return updated;
        });
        if (!product) throw productNotFound();
        return withUsage(product);
      },
    );
  }

  // DELETE /products/:id — só produto NUNCA usado; usado → arquive
  r.delete(
    "/products/:id",
    {
      schema: {
        tags: ["Produtos"],
        summary: "Exclui um produto nunca usado",
        params: productIdParamSchema,
      },
    },
    async (request, reply) => {
      const { count } = await request.db.product.deleteMany({
        where: { id: request.params.id, applications: { none: {} } },
      });
      if (count === 0) {
        const exists = await request.db.product.findUnique({ where: { id: request.params.id }, select: { id: true } });
        if (!exists) throw productNotFound();
        throw conflict(ErrorCode.PRODUCT_IN_USE, "Este produto já foi usado em aplicações. Arquive em vez de excluir.");
      }
      return reply.status(204).send();
    },
  );

  // ── APLICAÇÕES ──

  // POST /applications — registra uma aplicação (em lote, guarda individual)
  r.post(
    "/applications",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Registra uma aplicação (vacina, vermífugo, antiparasitário, remédio)",
        body: createApplicationSchema,
      },
    },
    async (request, reply) => {
      const {
        productId,
        date,
        reapplyDate,
        notes,
        animalIds,
        batchNumber,
        doseAmount,
        doseUnit,
        reappliesApplicationId,
        idempotencyKey,
      } = request.body;
      const farmId = request.auth.farm.id;

      // Envio repetido (mesmo identificador): devolve a aplicação já gravada
      const findRepeated = () =>
        idempotencyKey
          ? request.db.application.findFirst({ where: { idempotencyKey }, include: APPLICATION_INCLUDE })
          : Promise.resolve(null);
      const repeated = await findRepeated();
      if (repeated) return reply.status(200).send(repeated);

      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);

      // 1. produto desta fazenda e não arquivado
      const product = await request.db.product.findUnique({ where: { id: productId } });
      if (!product) throw productNotFound();
      if (product.archivedAt) throw productArchived();

      // 2. animais da fazenda, todos no rebanho na data (RN-SAN-003)
      await assertAnimalsExist(request.db, animalIds);
      await assertAnimalsInHerdOnDate(request.db, animalIds, date);

      // 3. reaplicação a partir de um lembrete (D-40): o de origem tem que
      //    existir nesta fazenda, ter reaplicação marcada e não ser posterior
      if (reappliesApplicationId) {
        const source = await request.db.application.findUnique({
          where: { id: reappliesApplicationId },
          select: { date: true, reapplyDate: true },
        });
        if (!source || !source.reapplyDate || calendarDateOf(source.date) > date) {
          throw badRequest(ErrorCode.REAPPLY_SOURCE_INVALID, "Não encontramos o lembrete desta reaplicação.");
        }
      }

      // 4. o evento JÁ com as ligações por animal (criação ANINHADA: farmId explícito)
      try {
        const application = await request.db.application.create({
          data: {
            farmId,
            productId,
            date: toDbDate(date),
            reapplyDate: reapplyDate ? toDbDate(reapplyDate) : null,
            notes,
            batchNumber: batchNumber ?? null,
            doseAmount: decimalOrNull(doseAmount),
            doseUnit: doseUnit ?? null,
            ...withdrawalOf(date, product.withdrawalDays),
            reappliesApplicationId: reappliesApplicationId ?? null,
            idempotencyKey: idempotencyKey ?? null,
            createdById: request.auth.user.id, // D-51: quem registrou
            animals: { create: animalIds.map((animalId) => ({ animalId, farmId })) },
          },
          include: APPLICATION_INCLUDE,
        });
        return reply.status(201).send(application);
      } catch (error) {
        // Duas gravações ao mesmo tempo com o mesmo identificador
        if (uniqueViolation(error, "Application")?.includes("idempotencyKey")) {
          const existing = await findRepeated();
          if (existing) return reply.status(200).send(existing);
        }
        throw error;
      }
    },
  );

  // GET /applications — histórico por evento (tipo, período; paginação opcional)
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
      const { type, from, to, page, pageSize } = request.query;
      const where = {
        ...(type ? { product: { type } } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) } }
          : {}),
      };
      return request.db.application.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        ...(page ? { skip: (page - 1) * (pageSize ?? 50), take: pageSize ?? 50 } : {}),
        include: {
          product: true,
          _count: { select: { animals: true } }, // quantos animais no evento
        },
      });
    },
  );

  // GET /alerts — lembretes de reaplicação (D-40, RN-SAN-006/007/008):
  // dentro da antecedência da fazenda ou vencidos; saem só ao reaplicar a
  // partir dele, ao dispensar ou sem animal ativo. Conta só os ativos.
  r.get(
    "/alerts",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Lembretes de reaplicação (chegando ou vencidos)",
      },
    },
    async (request) => openReminders(request.db, request.auth.farm),
  );

  // POST /applications/:id/dismiss-reminder — "Dispensar" (D-40): motivo opcional
  r.post(
    "/applications/:id/dismiss-reminder",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Dispensa o lembrete de reaplicação",
        params: applicationIdParamSchema,
        body: dismissReminderSchema,
      },
    },
    async (request) => {
      const existing = await request.db.application.findUnique({
        where: { id: request.params.id },
        select: { id: true, reapplyDate: true, reminderDismissedAt: true },
      });
      if (!existing) throw applicationNotFound();
      if (!existing.reapplyDate) {
        throw conflict(ErrorCode.NO_REMINDER, "Esta aplicação não tem reaplicação marcada.");
      }
      return request.db.application.update({
        where: { id: existing.id },
        data: {
          reminderDismissedAt: existing.reminderDismissedAt ?? new Date(),
          reminderDismissReason: request.body.reason ?? null,
        },
        include: APPLICATION_INCLUDE,
      });
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
        include: { ...APPLICATION_INCLUDE, reappliedBy: { select: { id: true, date: true } } },
      });
      if (!application) throw applicationNotFound();
      return application;
    },
  );

  // PUT /applications/:id — corrige o lançamento (RN-SAN-011), inclusive os
  // animais (tirar quem não recebeu, incluir quem faltou). As regras do
  // cadastro valem na edição. Produto arquivado pode continuar numa aplicação
  // antiga, mas não entra por troca.
  r.put(
    "/applications/:id",
    {
      schema: {
        tags: ["Aplicações"],
        summary: "Corrige uma aplicação (dados e animais)",
        params: applicationIdParamSchema,
        body: updateApplicationSchema,
      },
    },
    async (request) => {
      const existing = await request.db.application.findUnique({
        where: { id: request.params.id },
        include: { animals: { select: { animalId: true } } },
      });
      if (!existing) throw applicationNotFound();

      const { productId, date, reapplyDate, notes, animalIds, batchNumber, doseAmount, doseUnit } = request.body;
      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);

      const product = await request.db.product.findUnique({ where: { id: productId } });
      if (!product) throw productNotFound();
      if (product.archivedAt && product.id !== existing.productId) throw productArchived();

      const finalAnimalIds = animalIds ?? existing.animals.map((link) => link.animalId);
      if (animalIds) await assertAnimalsExist(request.db, animalIds);
      // a data (e os animais) não podem deixar alguém fora do rebanho
      await assertAnimalsInHerdOnDate(request.db, finalAnimalIds, date);

      // Carência: troca de produto pega a do produto novo; o mesmo, mantém a copiada
      const days = product.id === existing.productId ? existing.withdrawalDays : product.withdrawalDays;
      const farmId = request.auth.farm.id;

      return request.db.$transaction(async (tx) => {
        if (animalIds) {
          const current = new Set(existing.animals.map((link) => link.animalId));
          const wanted = new Set(animalIds);
          const removed = [...current].filter((id) => !wanted.has(id));
          const added = animalIds.filter((id) => !current.has(id));
          if (removed.length > 0) {
            await tx.applicationAnimal.deleteMany({ where: { applicationId: existing.id, animalId: { in: removed } } });
          }
          if (added.length > 0) {
            await tx.applicationAnimal.createMany({
              data: added.map((animalId) => ({ applicationId: existing.id, animalId, farmId })),
            });
          }
        }
        return tx.application.update({
          where: { id: existing.id },
          data: {
            productId,
            date: toDbDate(date),
            reapplyDate: reapplyDate ? toDbDate(reapplyDate) : null,
            notes,
            ...(batchNumber !== undefined ? { batchNumber } : {}),
            ...(doseAmount !== undefined || doseUnit !== undefined
              ? { doseAmount: decimalOrNull(doseAmount), doseUnit: doseUnit ?? null }
              : {}),
            ...withdrawalOf(date, days),
          },
          include: APPLICATION_INCLUDE,
        });
      });
    },
  );

  // DELETE /applications/:id — exclui uma aplicação (confirmação na tela)
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
      const actor = actorOf(request.auth);
      const count = await request.db.$transaction(async (tx) => {
        const application = await tx.application.findUnique({
          where: { id: request.params.id },
          select: { date: true, product: { select: { name: true } }, _count: { select: { animals: true } } },
        });
        // as ligações (ApplicationAnimal) somem junto por causa do onDelete: Cascade
        const deleted = await tx.application.deleteMany({ where: { id: request.params.id } });
        if (deleted.count > 0 && application) {
          // Trilha (D-51/D-54): a exclusão fica registrada
          await recordAudit(tx, actor, {
            action: AuditAction.APPLICATION_DELETED,
            entityType: "Application",
            entityId: request.params.id,
            details: {
              product: application.product.name,
              date: calendarDateOf(application.date),
              animals: application._count.animals,
            },
          });
        }
        return deleted.count;
      });
      if (count === 0) throw applicationNotFound();
      return reply.status(204).send();
    },
  );

  // GET /animals/:id/applications — histórico sanitário de UM animal (ficha),
  // com o fim da carência de cada aplicação e se ainda está em carência hoje
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
      const animal = await request.db.animal.findUnique({ where: { id: request.params.id }, select: { id: true } });
      if (!animal) throw notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");
      const today = todayInTimeZone(request.auth.farm.timezone);
      const links = await request.db.applicationAnimal.findMany({
        where: { animalId: request.params.id },
        include: { application: { include: { product: true } } },
        orderBy: { application: { date: "desc" } },
      });
      return links.map(({ application }) => ({
        ...application,
        inWithdrawal: application.withdrawalEndDate ? calendarDateOf(application.withdrawalEndDate) > today : false,
      }));
    },
  );
}
