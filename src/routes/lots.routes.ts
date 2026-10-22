import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { assertNotInFuture, calendarDateOf } from "../lib/dates.js";
import { ErrorCode, conflict, notFound } from "../lib/errors.js";
import { AuditAction, actorOf, recordAudit } from "../lib/history.js";
import { lotNameTaken, moveAnimalsToLot } from "../lib/lots.js";
import type { FarmDb } from "../lib/tenant.js";
import { summarizeLot, withinMembership } from "../services/lot.service.js";
import {
  createLotSchema,
  listLotsQuerySchema,
  lotIdParamSchema,
  lotMoveSchema,
  updateLotSchema,
} from "../schemas/lot.schema.js";

// Lotes (D-49, aprovado em 2026-10-18 — versão simples): cadastro do lote,
// entrada/troca/saída de animais com data e quantidade por lote. Um lote por
// animal por vez; o histórico de onde esteve nunca é apagado.

const lotNotFound = () => notFound(ErrorCode.LOT_NOT_FOUND, "Lote não encontrado.");
const FUTURE_DATE = "A data não pode ser no futuro.";

async function assertLotNameAvailable(db: Pick<FarmDb, "lot">, name: string, exceptId?: string) {
  const taken = await db.lot.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw lotNameTaken();
}

// Quantos animais ATIVOS estão em cada lote agora
async function activeCounts(db: FarmDb, lotIds: string[]) {
  const rows = await db.lotMembership.groupBy({
    by: ["lotId"],
    where: { lotId: { in: lotIds }, endDate: null, animal: { status: "ACTIVE" } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.lotId, row._count._all]));
}

// Períodos de cada animal no lote (404 se o lote não for desta fazenda)
async function lotPeriods(db: FarmDb, lotId: string) {
  const lot = await db.lot.findUnique({ where: { id: lotId }, select: { id: true } });
  if (!lot) throw lotNotFound();
  const memberships = await db.lotMembership.findMany({
    where: { lotId },
    select: { animalId: true, startDate: true, endDate: true },
  });
  const periods = new Map<string, { startDate: string; endDate: string | null }[]>();
  for (const membership of memberships) {
    const list = periods.get(membership.animalId) ?? [];
    list.push({
      startDate: calendarDateOf(membership.startDate),
      endDate: membership.endDate ? calendarDateOf(membership.endDate) : null,
    });
    periods.set(membership.animalId, list);
  }
  return periods;
}

const inAnyPeriod = (periods: Map<string, { startDate: string; endDate: string | null }[]>, animalId: string, date: string) =>
  (periods.get(animalId) ?? []).some((period) => withinMembership(date, period));

export async function lotRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/lots",
    { schema: { tags: ["Lotes"], summary: "Cria um lote", body: createLotSchema } },
    async (request, reply) => {
      await assertLotNameAvailable(request.db, request.body.name);
      const lot = await request.db.lot.create({ data: { ...request.body, farmId: request.auth.farm.id } });
      return reply.status(201).send({ ...lot, activeCount: 0 });
    },
  );

  // GET /lots — com a quantidade de animais ativos em cada um
  r.get(
    "/lots",
    { schema: { tags: ["Lotes"], summary: "Lista os lotes (com quantos animais)", querystring: listLotsQuerySchema } },
    async (request) => {
      const lots = await request.db.lot.findMany({
        where: request.query.includeArchived === "true" ? {} : { archivedAt: null },
        orderBy: { name: "asc" },
      });
      const counts = await activeCounts(request.db, lots.map((lot) => lot.id));
      return lots.map((lot) => ({ ...lot, activeCount: counts.get(lot.id) ?? 0 }));
    },
  );

  // GET /lots/:id — o lote, quem está nele agora (com o último peso), o
  // resumo (services/lot.service.ts → summarizeLot) e o histórico
  r.get(
    "/lots/:id",
    { schema: { tags: ["Lotes"], summary: "Detalhes do lote", params: lotIdParamSchema } },
    async (request) => {
      const lot = await request.db.lot.findUnique({ where: { id: request.params.id } });
      if (!lot) throw lotNotFound();
      const memberships = await request.db.lotMembership.findMany({
        where: { lotId: lot.id },
        orderBy: [{ endDate: { sort: "desc", nulls: "first" } }, { startDate: "desc" }],
        include: {
          animal: {
            select: { id: true, tag: true, sex: true, category: true, status: true, breed: true },
          },
        },
      });
      const current = memberships.filter((membership) => membership.endDate === null && membership.animal.status === "ACTIVE");
      const weighings = await request.db.weighing.findMany({
        where: { animalId: { in: current.map((membership) => membership.animalId) } },
        orderBy: { date: "asc" },
        select: { animalId: true, date: true, weightKg: true },
      });
      const byAnimal = new Map<string, { date: string; weightKg: number }[]>();
      for (const weighing of weighings) {
        const list = byAnimal.get(weighing.animalId) ?? [];
        list.push({ date: calendarDateOf(weighing.date), weightKg: Number(weighing.weightKg) });
        byAnimal.set(weighing.animalId, list);
      }
      const animals = current.map((membership) => {
        const list = byAnimal.get(membership.animalId) ?? [];
        const last = list[list.length - 1];
        return {
          ...membership.animal,
          since: calendarDateOf(membership.startDate),
          currentWeightKg: last?.weightKg ?? null,
          lastWeighingDate: last?.date ?? null,
        };
      });
      const firstEntry = memberships.reduce<Date | null>(
        (first, membership) => (!first || membership.startDate < first ? membership.startDate : first),
        null,
      );
      return {
        ...lot,
        activeCount: current.length,
        formedOn: firstEntry ? calendarDateOf(firstEntry) : null,
        summary: summarizeLot(
          animals.map((animal) => ({ sex: animal.sex, since: animal.since, weighings: byAnimal.get(animal.id) ?? [] })),
        ),
        animals,
        history: memberships.map((membership) => ({
          id: membership.id,
          animal: { id: membership.animal.id, tag: membership.animal.tag },
          startDate: calendarDateOf(membership.startDate),
          endDate: membership.endDate ? calendarDateOf(membership.endDate) : null,
        })),
      };
    },
  );

  // GET /lots/:id/weighings — pesagens feitas enquanto cada animal estava NO
  // lote (entre a entrada e a saída), mais recentes primeiro (até 200)
  r.get(
    "/lots/:id/weighings",
    { schema: { tags: ["Lotes"], summary: "Pesagens dos animais durante a permanência no lote", params: lotIdParamSchema } },
    async (request) => {
      const periods = await lotPeriods(request.db, request.params.id);
      const weighings = await request.db.weighing.findMany({
        where: { animalId: { in: [...periods.keys()] } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { id: true, date: true, weightKg: true, source: true, animal: { select: { id: true, tag: true } } },
      });
      return weighings
        .filter((weighing) => inAnyPeriod(periods, weighing.animal.id, calendarDateOf(weighing.date)))
        .slice(0, 200)
        .map((weighing) => ({ ...weighing, date: calendarDateOf(weighing.date), weightKg: weighing.weightKg.toString() }));
    },
  );

  // GET /lots/:id/applications — aplicações em que algum animal estava no lote
  // na data da aplicação (quantos do lote receberam), mais recentes primeiro
  r.get(
    "/lots/:id/applications",
    { schema: { tags: ["Lotes"], summary: "Aplicações sanitárias dos animais durante a permanência no lote", params: lotIdParamSchema } },
    async (request) => {
      const periods = await lotPeriods(request.db, request.params.id);
      const links = await request.db.applicationAnimal.findMany({
        where: { animalId: { in: [...periods.keys()] } },
        select: {
          animalId: true,
          application: {
            select: {
              id: true,
              date: true,
              reapplyDate: true,
              product: { select: { id: true, name: true, type: true } },
              _count: { select: { animals: true } },
            },
          },
        },
      });
      const grouped = new Map<string, { application: (typeof links)[number]["application"]; inLot: number }>();
      for (const link of links) {
        if (!inAnyPeriod(periods, link.animalId, calendarDateOf(link.application.date))) continue;
        const entry = grouped.get(link.application.id) ?? { application: link.application, inLot: 0 };
        entry.inLot += 1;
        grouped.set(link.application.id, entry);
      }
      return [...grouped.values()]
        .sort((a, b) => b.application.date.getTime() - a.application.date.getTime())
        .map(({ application, inLot }) => ({
          id: application.id,
          date: calendarDateOf(application.date),
          reapplyDate: application.reapplyDate ? calendarDateOf(application.reapplyDate) : null,
          product: application.product,
          animalsTotal: application._count.animals,
          animalsInLot: inLot,
        }));
    },
  );

  r.put(
    "/lots/:id",
    { schema: { tags: ["Lotes"], summary: "Edita o lote", params: lotIdParamSchema, body: updateLotSchema } },
    async (request) => {
      const lot = await request.db.lot.findUnique({ where: { id: request.params.id } });
      if (!lot) throw lotNotFound();
      if (request.body.name !== undefined) await assertLotNameAvailable(request.db, request.body.name, lot.id);
      const updated = await request.db.lot.update({ where: { id: lot.id }, data: request.body });
      const counts = await activeCounts(request.db, [lot.id]);
      return { ...updated, activeCount: counts.get(lot.id) ?? 0 };
    },
  );

  // POST /lots/:id/animals — entram no lote (ou trocam de lote) na data
  r.post(
    "/lots/:id/animals",
    {
      schema: {
        tags: ["Lotes"],
        summary: "Coloca animais no lote (troca de lote, se estavam em outro)",
        params: lotIdParamSchema,
        body: lotMoveSchema,
      },
    },
    async (request) => {
      const { animalIds, date } = request.body;
      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);
      const lot = await request.db.lot.findUnique({ where: { id: request.params.id } });
      if (!lot) throw lotNotFound();
      if (lot.archivedAt) throw conflict(ErrorCode.LOT_ARCHIVED, "Este lote está arquivado. Reative-o para colocar animais.");
      const actor = actorOf(request.auth);
      return request.db.$transaction((tx) => moveAnimalsToLot(tx, actor, { id: lot.id, name: lot.name }, animalIds, date));
    },
  );

  // POST /lots/:id/remove — tiram do lote (ficam sem lote) na data
  r.post(
    "/lots/:id/remove",
    {
      schema: {
        tags: ["Lotes"],
        summary: "Tira animais do lote (ficam sem lote)",
        params: lotIdParamSchema,
        body: lotMoveSchema,
      },
    },
    async (request) => {
      const { animalIds, date } = request.body;
      assertNotInFuture(date, request.auth.farm.timezone, "date", FUTURE_DATE);
      const lot = await request.db.lot.findUnique({ where: { id: request.params.id }, select: { id: true } });
      if (!lot) throw lotNotFound();
      // Só quem está NESTE lote agora sai; os outros ficam como estão
      const inThisLot = await request.db.lotMembership.findMany({
        where: { lotId: lot.id, endDate: null, animalId: { in: animalIds } },
        select: { animalId: true },
      });
      const ids = inThisLot.map((membership) => membership.animalId);
      if (ids.length === 0) return { moved: 0, unchanged: animalIds.length };
      const actor = actorOf(request.auth);
      const result = await request.db.$transaction((tx) => moveAnimalsToLot(tx, actor, null, ids, date));
      return { moved: result.moved, unchanged: animalIds.length - result.moved };
    },
  );

  // Arquivar (só vazio) / reativar
  for (const [path, archived] of [
    ["/lots/:id/archive", true],
    ["/lots/:id/unarchive", false],
  ] as const) {
    r.patch(
      path,
      {
        schema: {
          tags: ["Lotes"],
          summary: archived ? "Arquiva um lote vazio" : "Reativa um lote arquivado",
          params: lotIdParamSchema,
        },
      },
      async (request) => {
        const lot = await request.db.lot.findUnique({ where: { id: request.params.id } });
        if (!lot) throw lotNotFound();
        if (archived) {
          const open = await request.db.lotMembership.count({ where: { lotId: lot.id, endDate: null } });
          if (open > 0) throw conflict(ErrorCode.LOT_NOT_EMPTY, "Tire os animais do lote antes de arquivar.");
        }
        const updated = await request.db.lot.update({
          where: { id: lot.id },
          data: { archivedAt: archived ? (lot.archivedAt ?? new Date()) : null },
        });
        return { ...updated, activeCount: 0 };
      },
    );
  }

  // DELETE /lots/:id — só lote que nunca teve animal (senão: arquivar)
  r.delete(
    "/lots/:id",
    { schema: { tags: ["Lotes"], summary: "Exclui um lote que nunca teve animais", params: lotIdParamSchema } },
    async (request, reply) => {
      const actor = actorOf(request.auth);
      const result = await request.db.$transaction(async (tx) => {
        const lot = await tx.lot.findUnique({ where: { id: request.params.id }, select: { id: true, name: true } });
        if (!lot) return "NOT_FOUND" as const;
        const { count } = await tx.lot.deleteMany({ where: { id: lot.id, memberships: { none: {} } } });
        if (count === 0) return "IN_USE" as const;
        await recordAudit(tx, actor, { action: AuditAction.LOT_DELETED, entityType: "Lot", entityId: lot.id, details: { name: lot.name } });
        return "DELETED" as const;
      });
      if (result === "NOT_FOUND") throw lotNotFound();
      if (result === "IN_USE") throw conflict(ErrorCode.LOT_IN_USE, "Este lote já teve animais. Arquive em vez de excluir.");
      return reply.status(204).send();
    },
  );
}
