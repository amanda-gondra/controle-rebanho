import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { assertNotInFuture, calendarDateOf, toDbDate } from "../lib/dates.js";
import type { FarmDb } from "../lib/tenant.js";
import {
  ErrorCode,
  conflict,
  notFound,
  unprocessable,
} from "../lib/errors.js";
import {
  createAnimalSchema,
  animalIdParamSchema,
  listAnimalsQuerySchema,
  updateStatusSchema,
  updateAnimalSchema,
  tagChangeSchema,
  historyQuerySchema,
} from "../schemas/animal.schema.js";
import {
  weighingBodySchema,
  weighingParamsSchema,
} from "../schemas/weighing.schema.js";
import { calculateWeightGain, gainsSincePrevious } from "../services/weighing.service.js";
import { resolveAnimalProfile } from "../services/animal.service.js";
import { assertExitDateAllowed, assertWeighingDateAllowed } from "../lib/animal-life.js";
import { fieldError, ruleError } from "../lib/errors.js";
import { categoriesMatching, resolveCategoryLabels } from "../lib/categories.js";
import type { Prisma } from "@prisma/client";
import {
  AuditAction,
  actorOf,
  assertTagAvailable,
  recordAnimalChanges,
  recordAudit,
  snapshotOf,
} from "../lib/history.js";
import { checkEntryDate, diffAnimal } from "../services/animal-history.service.js";
import { syncLotWithExit } from "../lib/lots.js";

const animalNotFound = () =>
  notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");

const weighingNotFound = () =>
  notFound(ErrorCode.WEIGHING_NOT_FOUND, "Pesagem não encontrada.");

const FUTURE_BIRTH = "A data de nascimento não pode ser no futuro.";
const FUTURE_WEIGHING = "A data da pesagem não pode ser no futuro.";

// Pesagem criada por compra/venda só muda pela negociação (RN-PES-009, D-08)
function assertNotFromTrade(source: string) {
  if (source !== "MANUAL") {
    throw conflict(
      ErrorCode.WEIGHING_FROM_TRADE,
      "Esta pesagem veio de uma compra ou venda. Para mudar, corrija a negociação.",
    );
  }
}

const day = (date: Date | null) => (date ? calendarDateOf(date) : null);

// Entrada na fazenda (D-52): não no futuro, não antes do nascimento (dia
// certo), não depois da saída
function assertEntryDateAllowed(
  entryDate: string | null,
  animal: { birthDate: string | null; birthPrecision: string; exitDate: string | null },
  timezone: string,
) {
  if (!entryDate) return;
  assertNotInFuture(entryDate, timezone, "entryDate", "A data de entrada não pode ser no futuro.");
  const problem = checkEntryDate(entryDate, animal);
  if (problem) {
    throw ruleError(
      ErrorCode.ENTRY_DATE_OUT_OF_RANGE,
      problem.reason === "BEFORE_BIRTH"
        ? "A entrada não pode ser antes do nascimento."
        : "A entrada não pode ser depois da saída.",
      [{ field: "entryDate", code: ErrorCode.ENTRY_DATE_OUT_OF_RANGE, params: problem, error: "Data de entrada fora da vida do animal." }],
      422,
    );
  }
}

// O que a ficha mostra além do animal: o brinco anterior (D-19 — "antes:
// BR-104") e o lote atual com a data de entrada (D-49)
async function withPreviousTag<T extends { id: string }>(db: FarmDb, animal: T) {
  const [lastChange, membership] = await Promise.all([
    db.animalEvent.findFirst({
      where: { animalId: animal.id, type: "TAG_CHANGED" },
      orderBy: [{ createdAt: "desc" }, { sequence: "desc" }],
      select: { fromValue: true },
    }),
    db.lotMembership.findFirst({
      where: { animalId: animal.id, endDate: null },
      select: { startDate: true, lot: { select: { id: true, name: true } } },
    }),
  ]);
  return {
    ...animal,
    previousTag: lastChange?.fromValue ?? null,
    lot: membership ? { ...membership.lot, since: calendarDateOf(membership.startDate) } : null,
  };
}

// Garante que o animal existe NESTA fazenda; senão, 404.
async function findAnimalOrFail(db: FarmDb, id: string) {
  const animal = await db.animal.findUnique({ where: { id } });
  if (!animal) throw animalNotFound();
  return animal;
}

export async function animalRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /animals
  r.post(
    "/animals",
    {
      schema: {
        tags: ["Animais"],
        summary: "Cadastra um novo animal",
        body: createAnimalSchema,
      },
    },
    async (request, reply) => {
      const { birthDate, sex, category, castrated, entryDate, origin, ...rest } = request.body;
      const timezone = request.auth.farm.timezone;
      assertNotInFuture(birthDate, timezone, "birthDate", FUTURE_BIRTH);
      assertEntryDateAllowed(entryDate ?? null, { birthDate: birthDate ?? null, birthPrecision: rest.birthPrecision, exitDate: null }, timezone);
      // "Comprado" vem da compra registrada em Negociações (D-52): pelo cadastro
      // direto, compra sem negociação fica como "recebido" ou "não informado"
      if (origin === "PURCHASED") {
        throw fieldError("origin", ErrorCode.ORIGIN_FROM_PURCHASE, "Para registrar uma compra, use Negociações → Nova compra.");
      }
      // Categoria × sexo e castrado (G4); castrado padrão vem da fazenda
      const profile = resolveAnimalProfile(
        null,
        { sex, category, castrated },
        request.auth.farm.settings.defaultCastrated,
      );
      // Brinco sem diferenciar maiúsculas (D-29); o índice do banco garante de novo
      await assertTagAvailable(request.db, rest.tag);
      const animal = await request.db.animal.create({
        data: {
          ...rest,
          ...profile,
          origin,
          farmId: request.auth.farm.id,
          createdById: request.auth.user.id,
          ...(birthDate ? { birthDate: toDbDate(birthDate) } : {}),
          ...(entryDate ? { entryDate: toDbDate(entryDate) } : {}),
        },
      });
      return reply.status(201).send({ ...animal, previousTag: null });
    },
  );

  // GET /animals
  r.get(
    "/animals",
    {
      schema: {
        tags: ["Animais"],
        summary: "Lista os animais (com filtros e ordenação)",
        querystring: listAnimalsQuerySchema,
      },
    },
    async (request) => {
      const { q, tag, status, category, sex, lotId, sortBy, order, page, pageSize } = request.query;
      const oldTag = (match: Prisma.StringFilter) => ({ events: { some: { type: "TAG_CHANGED" as const, fromValue: match } } });

      const and: Prisma.AnimalWhereInput[] = [];
      if (status) and.push({ status });
      if (category) and.push({ category });
      if (sex) and.push({ sex });
      if (lotId === "none") and.push({ lotMemberships: { none: { endDate: null } } });
      else if (lotId) and.push({ lotMemberships: { some: { lotId, endDate: null } } });
      // Brinco exato (atual ou antigo), sem diferenciar maiúsculas (D-19/D-29)
      if (tag) {
        const match = { equals: tag, mode: "insensitive" as const };
        and.push({ OR: [{ tag: match }, oldTag(match)] });
      }
      // Busca: brinco (atual ou antigo), raça ou nome da categoria da fazenda
      if (q) {
        const match = { contains: q, mode: "insensitive" as const };
        const categories = categoriesMatching(q, resolveCategoryLabels(request.auth.farm.settings.categoryLabels));
        and.push({
          OR: [{ tag: match }, { breed: match }, oldTag(match), ...categories.map(({ category, sex }) => ({ category, sex }))],
        });
      }
      const where: Prisma.AnimalWhereInput = and.length > 0 ? { AND: and } : {};

      const [animals, total, byStatus] = await Promise.all([
        request.db.animal.findMany({
          where,
          orderBy: [{ [sortBy]: order }, { id: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            weighings: { orderBy: { date: "desc" }, take: 1, select: { date: true, weightKg: true } },
            tradeItems: { select: { type: true } },
            lotMemberships: { where: { endDate: null }, select: { lot: { select: { id: true, name: true } } } },
            ...(q || tag
              ? { events: { where: { type: "TAG_CHANGED" }, select: { fromValue: true } } }
              : {}),
          },
        }),
        request.db.animal.count({ where }),
        // Contadores do topo e das abas: sempre sobre o rebanho inteiro
        request.db.animal.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);

      const counts = { ALL: 0, ACTIVE: 0, SOLD: 0, DEAD: 0 };
      for (const row of byStatus) {
        counts[row.status] = row._count._all;
        counts.ALL += row._count._all;
      }

      return {
        items: animals.map(({ weighings, tradeItems, lotMemberships, ...animal }) => {
          const events = (animal as { events?: { fromValue: string | null }[] }).events;
          const { events: _events, ...rest } = animal as typeof animal & { events?: unknown };
          return {
            ...rest,
            currentWeightKg: weighings[0] ? Number(weighings[0].weightKg) : null,
            lastWeighingDate: weighings[0] ? weighings[0].date : null,
            // Para as telas de negociação: quem já tem compra/venda registrada
            hasPurchase: tradeItems.some((item) => item.type === "PURCHASE"),
            hasSale: tradeItems.some((item) => item.type === "SALE"),
            lot: lotMemberships[0]?.lot ?? null,
            // Na busca: brincos antigos (para a tela mostrar "brinco atual: BR-210")
            ...(events ? { previousTags: events.map((event) => event.fromValue).filter((value): value is string => !!value) } : {}),
          };
        }),
        total,
        page,
        pageSize,
        counts,
      };
    },
  );

  // GET /animals/:id
  r.get(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Busca um animal pelo id",
        params: animalIdParamSchema,
      },
    },
    async (request) => withPreviousTag(request.db, await findAnimalOrFail(request.db, request.params.id)),
  );

  // PUT /animals/:id
  r.put(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Edita os dados de um animal (null limpa raça, nascimento e observações)",
        params: animalIdParamSchema,
        body: updateAnimalSchema,
      },
    },
    async (request) => {
      const current = await findAnimalOrFail(request.db, request.params.id);

      const { birthDate, birthPrecision, sex, category, castrated, origin, entryDate, ...rest } = request.body;
      const timezone = request.auth.farm.timezone;
      assertNotInFuture(birthDate, timezone, "birthDate", FUTURE_BIRTH);
      // Confere a combinação FINAL (o que já tinha + o que mudou): corrigir o
      // sexo de um garrote para fêmea sem trocar a categoria é recusado.
      const profile = resolveAnimalProfile(
        current,
        { sex, category, castrated },
        request.auth.farm.settings.defaultCastrated,
      );

      // Origem e entrada (D-52): com compra registrada, vêm da compra
      if (origin !== undefined || entryDate !== undefined) {
        const purchase = await request.db.tradeItem.findUnique({
          where: { animalId_type: { animalId: current.id, type: "PURCHASE" } },
          select: { id: true },
        });
        const changesOrigin =
          (origin !== undefined && origin !== current.origin) ||
          (entryDate !== undefined && entryDate !== day(current.entryDate));
        if (changesOrigin && (purchase || origin === "PURCHASED")) {
          throw fieldError(
            "origin",
            ErrorCode.ORIGIN_FROM_PURCHASE,
            purchase
              ? "A origem e a entrada deste animal vêm da compra registrada. Corrija a compra."
              : "Para registrar uma compra, use Negociações → Nova compra.",
          );
        }
      }
      const finalBirthDate = birthDate === undefined ? day(current.birthDate) : birthDate;
      const finalPrecision = birthDate === null ? "UNKNOWN" : (birthPrecision ?? current.birthPrecision);
      const finalEntryDate = entryDate === undefined ? day(current.entryDate) : entryDate;
      if (entryDate !== undefined || birthDate !== undefined || birthPrecision !== undefined) {
        assertEntryDateAllowed(
          finalEntryDate,
          { birthDate: finalBirthDate, birthPrecision: finalPrecision, exitDate: day(current.exitDate) },
          timezone,
        );
      }

      const actor = actorOf(request.auth);
      return request.db.$transaction(async (tx) => {
        const updated = await tx.animal.update({
          where: { id: request.params.id },
          data: {
            ...rest,
            ...profile,
            ...(origin !== undefined ? { origin } : {}),
            ...(entryDate !== undefined ? { entryDate: entryDate === null ? null : toDbDate(entryDate) } : {}),
            ...(birthDate !== undefined
              ? { birthDate: birthDate === null ? null : toDbDate(birthDate) }
              : {}),
            // Sem data de nascimento, a precisão volta a "desconhecida"
            ...(birthDate === null
              ? { birthPrecision: "UNKNOWN" as const }
              : birthPrecision !== undefined
                ? { birthPrecision }
                : {}),
          },
        });
        // Linha do tempo (D-28): categoria, sexo, nascimento, origem
        await recordAnimalChanges(tx, actor, updated.id, diffAnimal(snapshotOf(current), snapshotOf(updated)));
        return withPreviousTag(tx as FarmDb, updated);
      });
    },
  );

  // DELETE /animals/:id
  // D-10: animal com compra ou venda NÃO pode ser excluído (o histórico
  // financeiro não some). Sem transação, a exclusão leva junto pesagens e
  // participações em aplicações (cascata do banco, num passo só — F-22).
  r.delete(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Exclui um animal sem compra nem venda (e as pesagens dele)",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const actor = actorOf(request.auth);

      const deleted = await request.db.$transaction(async (tx) => {
        const animal = await tx.animal.findUnique({
          where: { id },
          select: { tag: true, _count: { select: { weighings: true, applications: true } } },
        });
        // Uma instrução só: apaga apenas se não houver compra nem venda.
        const { count } = await tx.animal.deleteMany({ where: { id, tradeItems: { none: {} } } });
        if (count === 0 || !animal) return false;
        // Trilha (D-54): a exclusão física fica registrada — quem, quando, o quê
        await recordAudit(tx, actor, {
          action: AuditAction.ANIMAL_DELETED,
          entityType: "Animal",
          entityId: id,
          details: { tag: animal.tag, weighings: animal._count.weighings, applications: animal._count.applications },
        });
        return true;
      });

      if (!deleted) {
        // Não apagou: ou não existe, ou tem histórico financeiro.
        await findAnimalOrFail(request.db, id);
        throw conflict(
          ErrorCode.ANIMAL_HAS_TRANSACTIONS,
          "Este animal tem compra ou venda registrada e não pode ser excluído.",
        );
      }

      return reply.status(204).send();
    },
  );

  // GET /animals/:id/delete-impact — o que some junto (F-ANI-07: a
  // confirmação lista as quantidades antes de excluir)
  r.get(
    "/animals/:id/delete-impact",
    {
      schema: {
        tags: ["Animais"],
        summary: "O que será apagado junto com o animal (e se pode ser apagado)",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      const animal = await request.db.animal.findUnique({
        where: { id: request.params.id },
        select: { _count: { select: { weighings: true, applications: true, tradeItems: true } } },
      });
      if (!animal) throw animalNotFound();
      return {
        weighings: animal._count.weighings,
        applications: animal._count.applications,
        hasTransactions: animal._count.tradeItems > 0,
      };
    },
  );

  // POST /animals/:id/tag-changes — troca de brinco (D-19, RN-ANIMAL-015)
  // O id do animal não muda: pesagens, aplicações e negociações continuam
  // nele. O brinco antigo fica na linha do tempo (com motivo e data) e a
  // busca da lista encontra o animal por ele.
  r.post(
    "/animals/:id/tag-changes",
    {
      schema: {
        tags: ["Animais"],
        summary: "Troca o brinco do animal guardando o anterior",
        params: animalIdParamSchema,
        body: tagChangeSchema,
      },
    },
    async (request) => {
      const animal = await findAnimalOrFail(request.db, request.params.id);
      const { newTag, reason, date } = request.body;
      assertNotInFuture(date, request.auth.farm.timezone, "date", "A data da troca não pode ser no futuro.");
      if (newTag === animal.tag) {
        throw fieldError("newTag", ErrorCode.SAME_TAG, "O novo brinco é igual ao atual.");
      }
      // Só mudar maiúscula/minúscula ("br-1" → "BR-1") é correção do mesmo brinco
      await assertTagAvailable(request.db, newTag, animal.id);

      const actor = actorOf(request.auth);
      return request.db.$transaction(async (tx) => {
        const updated = await tx.animal.update({ where: { id: animal.id }, data: { tag: newTag } });
        await recordAnimalChanges(tx, actor, animal.id, [
          { type: "TAG_CHANGED", fromValue: animal.tag, toValue: newTag, reason, effectiveDate: date },
        ]);
        return { ...updated, previousTag: animal.tag };
      });
    },
  );

  // GET /animals/:id/history — linha do tempo (D-28), mais recente primeiro
  r.get(
    "/animals/:id/history",
    {
      schema: {
        tags: ["Animais"],
        summary: "Linha do tempo do animal: o que mudou, quando e quem registrou",
        params: animalIdParamSchema,
        querystring: historyQuerySchema,
      },
    },
    async (request) => {
      const animal = await findAnimalOrFail(request.db, request.params.id);
      const { page, pageSize } = request.query;
      const where = { animalId: animal.id };
      const [items, total] = await Promise.all([
        request.db.animalEvent.findMany({
          where,
          // mais recente primeiro; dentro da mesma alteração, na ordem da tela
          orderBy: [{ createdAt: "desc" }, { sequence: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { user: { select: { name: true } } },
        }),
        request.db.animalEvent.count({ where }),
      ]);
      return {
        // O cadastro em si (com quem cadastrou) abre a história
        createdAt: animal.createdAt,
        items: items.map(({ user, userId: _userId, farmId: _farmId, sequence: _sequence, ...event }) => ({
          ...event,
          effectiveDate: calendarDateOf(event.effectiveDate),
          userName: user?.name ?? null,
        })),
        total,
        page,
        pageSize,
      };
    },
  );

  // PATCH /animals/:id/status — muda a situação e registra a SAÍDA (D-27)
  // - ativo ⇄ morto; ativo ⇄ vendido (sem venda registrada). Morto ⇄ vendido
  //   direto não: volte para ativo antes (RN-ANIMAL-010).
  // - Mesma situação de novo = corrigir a data/causa da saída.
  // - D-06: animal com venda registrada fica "vendido"; para mudar, desfaça a venda.
  r.patch(
    "/animals/:id/status",
    {
      schema: {
        tags: ["Animais"],
        summary: "Muda o status (ativo/vendido/morto)",
        params: animalIdParamSchema,
        body: updateStatusSchema,
      },
    },
    async (request) => {
      const animal = await request.db.animal.findUnique({
        where: { id: request.params.id },
        include: { tradeItems: { where: { type: "SALE" }, select: { id: true } } },
      });
      if (!animal) throw animalNotFound();

      const { status, exitDate, deathCause, deathCauseCertainty } = request.body;

      // Com venda registrada, a saída é a da venda: só "Desfazer venda" muda
      if (animal.tradeItems.length > 0) {
        throw conflict(
          ErrorCode.ANIMAL_HAS_SALE,
          "Este animal tem uma venda registrada. Para mudar o status, desfaça a venda.",
        );
      }

      const actor = actorOf(request.auth);
      // Grava a mudança e o evento da linha do tempo juntos (D-28)
      const save = (data: {
        status: "ACTIVE" | "SOLD" | "DEAD";
        exitDate: Date | null;
        deathCause: string | null;
        deathCauseCertainty: "CONFIRMED" | "SUSPECTED" | "NOT_INFORMED" | null;
      }) =>
        request.db.$transaction(async (tx) => {
          const updated = await tx.animal.update({ where: { id: animal.id }, data });
          // Saída mexe no lote: fecha, move o fim ou reabre o período (D-49)
          await syncLotWithExit(tx, animal.id, day(animal.exitDate), day(updated.exitDate));
          const changes = diffAnimal(snapshotOf(animal), snapshotOf(updated)).map((change) => ({
            ...change,
            effectiveDate: day(updated.exitDate),
          }));
          await recordAnimalChanges(tx, actor, animal.id, changes);
          return withPreviousTag(tx as FarmDb, updated);
        });

      // Voltar para ativo (ex.: morte registrada por engano): apaga a saída
      if (status === "ACTIVE") {
        return save({ status, exitDate: null, deathCause: null, deathCauseCertainty: null });
      }

      // Morto ⇄ vendido direto não existe na vida real; passa por ativo
      if (animal.status !== "ACTIVE" && animal.status !== status) {
        throw conflict(
          ErrorCode.INVALID_STATUS_TRANSITION,
          "Para mudar de morto para vendido (ou o contrário), volte o animal para ativo antes.",
        );
      }

      if (!exitDate) {
        throw fieldError("exitDate", "REQUIRED", "Informe a data de saída.");
      }
      assertNotInFuture(exitDate, request.auth.farm.timezone, "exitDate", "A data de saída não pode ser no futuro.");
      await assertExitDateAllowed(request.db, animal, exitDate, "exitDate");

      return save({
        status,
        exitDate: toDbDate(exitDate),
        // causa e certeza só existem na morte
        deathCause: status === "DEAD" ? deathCause || null : null,
        deathCauseCertainty: status === "DEAD" ? (deathCauseCertainty ?? "NOT_INFORMED") : null,
      });
    },
  );

  // POST /animals/:id/weighings
  r.post(
    "/animals/:id/weighings",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Registra uma pesagem",
        params: animalIdParamSchema,
        body: weighingBodySchema,
      },
    },
    async (request, reply) => {
      const animal = await findAnimalOrFail(request.db, request.params.id);
      assertNotInFuture(request.body.date, request.auth.farm.timezone, "date", FUTURE_WEIGHING);
      // Nada depois da saída nem antes do nascimento (RN-ANIMAL-012, RN-PES-004).
      // Mesmo dia de outra pesagem → o banco recusa (DUPLICATE_WEIGHING_DATE, D-33).
      assertWeighingDateAllowed(animal, request.body.date);
      const weighing = await request.db.weighing.create({
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
          animalId: request.params.id,
          farmId: request.auth.farm.id,
          createdById: request.auth.user.id, // D-51: quem registrou
        },
      });
      return reply.status(201).send(weighing);
    },
  );

  // GET /animals/:id/weighings
  r.get(
    "/animals/:id/weighings",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Histórico de pesagens do animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      await findAnimalOrFail(request.db, request.params.id);
      const weighings = await request.db.weighing.findMany({
        where: { animalId: request.params.id },
        orderBy: { date: "desc" },
      });
      // "Ganho desde a anterior" (RN-PES-008): informação, não indicador novo
      const gains = gainsSincePrevious(weighings.map((weighing) => ({ date: weighing.date, weightKg: weighing.weightKg.toString() })));
      return weighings.map((weighing, index) => ({ ...weighing, gainSincePrevious: gains[index] }));
    },
  );

  // PUT /animals/:id/weighings/:weighingId — edita uma pesagem
  r.put(
    "/animals/:id/weighings/:weighingId",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Edita uma pesagem",
        params: weighingParamsSchema,
        body: weighingBodySchema,
      },
    },
    async (request) => {
      assertNotInFuture(request.body.date, request.auth.farm.timezone, "date", FUTURE_WEIGHING);
      const animal = await findAnimalOrFail(request.db, request.params.id);
      const existing = await request.db.weighing.findFirst({
        where: { id: request.params.weighingId, animalId: request.params.id },
        select: { source: true },
      });
      if (!existing) throw weighingNotFound();
      assertNotFromTrade(existing.source);
      assertWeighingDateAllowed(animal, request.body.date);

      // a pesagem tem que existir E pertencer a este animal (e a esta fazenda)
      const { count } = await request.db.weighing.updateMany({
        where: { id: request.params.weighingId, animalId: request.params.id },
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
        },
      });
      if (count === 0) throw weighingNotFound();

      return request.db.weighing.findUniqueOrThrow({
        where: { id: request.params.weighingId },
      });
    },
  );

  // DELETE /animals/:id/weighings/:weighingId — exclui uma pesagem
  r.delete(
    "/animals/:id/weighings/:weighingId",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Exclui uma pesagem",
        params: weighingParamsSchema,
      },
    },
    async (request, reply) => {
      const existing = await request.db.weighing.findFirst({
        where: { id: request.params.weighingId, animalId: request.params.id },
        select: { source: true, date: true, weightKg: true },
      });
      if (!existing) throw weighingNotFound();
      assertNotFromTrade(existing.source);

      const actor = actorOf(request.auth);
      const count = await request.db.$transaction(async (tx) => {
        // a pesagem tem que existir E pertencer a este animal (e a esta fazenda);
        // só apaga se continuar sendo manual (numa instrução só)
        const deleted = await tx.weighing.deleteMany({
          where: { id: request.params.weighingId, animalId: request.params.id, source: "MANUAL" },
        });
        if (deleted.count > 0) {
          await recordAudit(tx, actor, {
            action: AuditAction.WEIGHING_DELETED,
            entityType: "Weighing",
            entityId: request.params.weighingId,
            details: { animalId: request.params.id, date: calendarDateOf(existing.date), weightKg: existing.weightKg.toString() },
          });
        }
        return deleted.count;
      });
      if (count === 0) throw weighingNotFound();
      return reply.status(204).send();
    },
  );

  // GET /animals/:id/weight-gain
  r.get(
    "/animals/:id/weight-gain",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Ganho de peso e GMD do animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      await findAnimalOrFail(request.db, request.params.id);
      const outcome = await calculateWeightGain(request.db, request.params.id);

      if (!outcome.ok) {
        throw outcome.reason === "SAME_DAY_WEIGHINGS"
          ? unprocessable(
              ErrorCode.SAME_DAY_WEIGHINGS,
              "A primeira e a última pesagem são do mesmo dia. Registre uma pesagem em outra data para calcular o ganho de peso.",
            )
          : unprocessable(
              ErrorCode.INSUFFICIENT_WEIGHINGS,
              "São necessárias pelo menos duas pesagens para calcular o ganho de peso.",
            );
      }

      return outcome.value;
    },
  );
}
