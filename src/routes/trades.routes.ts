import { AuditAction, actorOf, recordAudit } from "../lib/history.js";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { assertNotInFuture, calendarDateOf, toDbDate } from "../lib/dates.js";
import { uniqueViolation } from "../lib/error-handler.js";
import { ErrorCode, conflict, notFound, type FieldError } from "../lib/errors.js";
import { categoryLabelKey } from "../lib/categories.js";
import type { FarmDb } from "../lib/tenant.js";
import {
  TRADE_DETAIL_INCLUDE,
  assertItemsFitPricing,
  createTradeWeighings,
  findAnimalProblems,
  planNewAnimals,
  itemValue,
  problemToFieldError,
  resolvePricing,
  revertItems,
  updateAnimalsWithHistory,
  fillPurchaseOrigin,
  findWithdrawalWarnings,
  withdrawalWarning,
  syncItemWeighing,
  toTradeView,
  tradeItemErrors,
} from "../lib/trades.js";
import {
  createTradeSchema,
  lastPricesQuerySchema,
  listTradesQuerySchema,
  tradesSummaryQuerySchema,
  tradeIdParamSchema,
  tradeItemParamsSchema,
  updateTradeSchema,
} from "../schemas/trade.schema.js";
import { sumValues, summarizeTrades } from "../services/trade.service.js";

// Negociações — compra e venda (G5, "Espec — Compra e venda").
// "Negocia em lote, guarda individual": uma negociação, um item por animal.
// Tudo o que uma negociação muda (itens, pesagens, situação dos animais) é
// gravado numa transação só: ou tudo, ou nada (RN-NEG-009).

const tradeNotFound = () => notFound(ErrorCode.TRADE_NOT_FOUND, "Negociação não encontrada.");

// Lotes grandes (até 5.000 animais) precisam de mais tempo que o padrão (5 s)
const TRANSACTION_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

const FUTURE_DATE = "A data da negociação não pode ser no futuro.";

const animalAlreadyInTrade = (type: "PURCHASE" | "SALE") =>
  type === "SALE"
    ? conflict(ErrorCode.ANIMAL_ALREADY_SOLD, "Um dos animais acabou de ser vendido em outra negociação.")
    : conflict(ErrorCode.ANIMAL_ALREADY_PURCHASED, "Um dos animais acabou de entrar em outra compra.");

async function findTradeDetail(db: FarmDb, where: { id: string } | { idempotencyKey: string }) {
  return db.trade.findFirst({ where, include: TRADE_DETAIL_INCLUDE });
}

export async function tradeRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /trades — registra uma compra ou venda de um ou muitos animais
  r.post(
    "/trades",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Registra uma compra ou venda (um ou muitos animais)",
        body: createTradeSchema,
      },
    },
    async (request, reply) => {
      const body = request.body;
      const farm = request.auth.farm;
      assertNotInFuture(body.date, farm.timezone, "date", FUTURE_DATE);

      // Envio repetido: devolve a negociação que já foi gravada (RN-NEG-016)
      if (body.idempotencyKey) {
        const existing = await findTradeDetail(request.db, { idempotencyKey: body.idempotencyKey });
        if (existing) return reply.status(200).send(toTradeView(existing));
      }

      const pricing = resolvePricing(body, farm.settings.arrobaLiveFactorKg, {
        arrobaBasis: body.arrobaBasis !== undefined,
        arrobaFactorKg: body.arrobaFactorKg !== undefined,
      });
      assertItemsFitPricing(
        pricing,
        body.items.map((item) => ({
          liveWeightKg: item.liveWeightKg ?? null,
          carcassWeightKg: item.carcassWeightKg ?? null,
          unitPrice: item.unitPrice,
        })),
      );

      // Animais NOVOS (compra em lote — D-36): mesmas regras do cadastro, e
      // o brinco não pode existir nem repetir na lista. Recebem o id agora.
      const newRows = body.items.flatMap((item, index) => (item.newAnimal ? [{ index, animal: item.newAnimal }] : []));
      const plannedNew = await planNewAnimals(
        request.db,
        body.type,
        newRows,
        farm.settings.defaultCastrated,
      );
      const errors: FieldError[] = [...plannedNew.errors];

      const items = body.items.map((item, index) => ({
        animalId: item.animalId ?? plannedNew.animals.get(index)?.id ?? "",
        isNew: item.newAnimal !== undefined,
        liveWeightKg: item.liveWeightKg ?? null,
        carcassWeightKg: item.carcassWeightKg ?? null,
        unitPrice: item.unitPrice,
        priceAdjusted: item.priceAdjusted ?? false,
      }));

      // Animais JÁ cadastrados: existem nesta fazenda e podem entrar? Erros linha por linha.
      const existingIds = items.filter((item) => !item.isNew).map((item) => item.animalId);
      const animals = await request.db.animal.findMany({
        where: { id: { in: existingIds } },
        select: { id: true, tag: true, status: true, exitDate: true, birthDate: true, birthPrecision: true },
      });
      const animalById = new Map(animals.map((animal) => [animal.id, animal]));
      const problems = await findAnimalProblems(request.db, body.type, body.date, animals);
      items.forEach((item, index) => {
        if (item.isNew) return;
        const animal = animalById.get(item.animalId);
        if (!animal) {
          errors.push({
            field: `items.${index}.animalId`,
            code: ErrorCode.ANIMAL_NOT_FOUND,
            error: "Animal não encontrado.",
          });
          return;
        }
        const problem = problems.get(animal.id);
        if (problem) errors.push(problemToFieldError(index, animal.tag, problem));
      });
      if (errors.length > 0) {
        // Dois envios iguais ao mesmo tempo: se o outro gravou entre a primeira
        // busca e esta conferência, o animal já aparece "vendido" — mas é a
        // MESMA operação, então devolve a negociação gravada (RN-NEG-016)
        if (body.idempotencyKey) {
          const existing = await findTradeDetail(request.db, { idempotencyKey: body.idempotencyKey });
          if (existing) return reply.status(200).send(toTradeView(existing));
        }
        throw tradeItemErrors(errors);
      }

      // Carência (D-12): aviso antes de gravar; reenviado com o aceite, grava
      // e guarda que o aviso foi mostrado e aceito
      const warnings = body.type === "SALE" ? await findWithdrawalWarnings(request.db, body.date, items) : [];
      if (warnings.length > 0 && !body.acknowledgeWithdrawal) throw withdrawalWarning(warnings);

      try {
        const { trade, replaced } = await request.db.$transaction(async (tx) => {
          // Primeiro os animais novos, depois a compra que aponta para eles
          // (origem "comprado" com a data da compra como entrada — D-52)
          if (plannedNew.animals.size > 0) {
            await tx.animal.createMany({
              data: [...plannedNew.animals.values()].map((animal) => ({
                ...animal,
                farmId: farm.id,
                origin: "PURCHASED" as const,
                entryDate: toDbDate(body.date),
                createdById: request.auth.user.id,
              })),
            });
          }
          const plan = await createTradeWeighings(tx, farm.id, body.type, body.date, items);
          const actor = actorOf(request.auth);
          const existingInTrade = items.filter((item) => !item.isNew).map((item) => item.animalId);

          // Venda = saída: vendido, com a data da venda (RN-NEG-006), na linha do tempo
          if (body.type === "SALE") {
            await updateAnimalsWithHistory(tx, actor, existingInTrade, {
              status: "SOLD",
              exitDate: toDbDate(body.date),
              deathCause: null,
              deathCauseCertainty: null,
            });
          } else {
            await fillPurchaseOrigin(tx, actor, existingInTrade, body.date);
          }

          const created = await tx.trade.create({
            data: {
              farmId: farm.id,
              type: body.type,
              date: toDbDate(body.date),
              priceUnit: pricing.priceUnit,
              arrobaBasis: pricing.arrobaBasis,
              arrobaFactorKg: pricing.arrobaFactorKg,
              currency: farm.currency,
              counterparty: body.counterparty || null,
              notes: body.notes || null,
              idempotencyKey: body.idempotencyKey ?? null,
              withdrawalWarningAccepted: warnings.length > 0,
              createdById: request.auth.user.id,
              items: {
                create: items.map((item) => ({
                  farmId: farm.id, // criação aninhada: o filtro da fazenda não entra aqui
                  animalId: item.animalId,
                  liveWeightKg: item.liveWeightKg,
                  carcassWeightKg: item.carcassWeightKg,
                  unitPrice: item.unitPrice,
                  priceAdjusted: item.priceAdjusted,
                  value: itemValue(pricing, item), // calculado AQUI (RN-NEG-010)
                  weighingId: plan.weighingIds.get(item.animalId) ?? null,
                })),
              },
            },
            include: TRADE_DETAIL_INCLUDE,
          });
          return { trade: created, replaced: plan.replaced };
        }, TRANSACTION_OPTIONS);

        return reply.status(201).send({ ...toTradeView(trade), replacedWeighings: replaced });
      } catch (error) {
        // Duas gravações ao mesmo tempo com o mesmo identificador: a segunda
        // esbarra numa unicidade (da negociação ou das pesagens do dia) —
        // devolve a primeira
        const isDuplicate = ["Trade", "TradeItem", "Weighing", "Animal"].some((model) => uniqueViolation(error, model));
        if (body.idempotencyKey && isDuplicate) {
          const existing = await findTradeDetail(request.db, { idempotencyKey: body.idempotencyKey });
          if (existing) return reply.status(200).send(toTradeView(existing));
        }
        // Outra negociação pegou o mesmo animal entre a conferência e a gravação
        if (uniqueViolation(error, "TradeItem")?.includes("animalId")) throw animalAlreadyInTrade(body.type);
        throw error;
      }
    },
  );

  // GET /trades — histórico de negociações (paginado)
  r.get(
    "/trades",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Lista compras e vendas (mais recentes primeiro)",
        querystring: listTradesQuerySchema,
      },
    },
    async (request) => {
      const { page, pageSize, ...filters } = request.query;
      const where = tradeFilter(filters);

      const [total, trades] = await Promise.all([
        request.db.trade.count({ where }),
        request.db.trade.findMany({
          where,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { items: { select: { value: true, animalId: true } } },
        }),
      ]);

      // negociação de UM animal: a lista mostra qual (brinco, sexo, categoria, raça)
      const singleIds = trades.filter((trade) => trade.items.length === 1).map((trade) => trade.items[0].animalId);
      const animals = singleIds.length
        ? await request.db.animal.findMany({
            where: { id: { in: singleIds } },
            select: { id: true, tag: true, sex: true, category: true, castrated: true, breed: true },
          })
        : [];
      const animalById = new Map(animals.map((animal) => [animal.id, animal]));

      return {
        page,
        pageSize,
        total,
        items: trades.map((trade) => {
          const values = trade.items.map((item) => item.value?.toFixed(2) ?? null);
          return {
            id: trade.id,
            type: trade.type,
            date: calendarDateOf(trade.date),
            priceUnit: trade.priceUnit,
            arrobaBasis: trade.arrobaBasis,
            currency: trade.currency,
            counterparty: trade.counterparty,
            animalCount: values.length,
            animal: values.length === 1 ? (animalById.get(trade.items[0].animalId) ?? null) : null,
            total: sumValues(values),
            knownTotal: sumValues(values.map((value) => value ?? "0.00")),
            pending: values.some((value) => value === null),
          };
        }),
      };
    },
  );

  // GET /trades/summary — quantas compras e vendas e quanto somam (mesmos
  // filtros da lista). Pendente não entra na soma; só a moeda da fazenda.
  r.get(
    "/trades/summary",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Resumo das negociações (quantidade e valores de compras e vendas)",
        querystring: tradesSummaryQuerySchema,
      },
    },
    async (request) => {
      const trades = await request.db.trade.findMany({
        where: tradeFilter(request.query),
        select: { type: true, currency: true, items: { select: { value: true } } },
      });
      const currency = request.auth.farm.currency;
      return {
        currency,
        ...summarizeTrades(
          trades.map((trade) => ({
            type: trade.type,
            currency: trade.currency,
            values: trade.items.map((item) => item.value?.toFixed(2) ?? null),
          })),
          currency,
        ),
      };
    },
  );

  // GET /trades/last-prices — o último preço usado por grupo (só referência:
  // a tela mostra "último usado: R$ 17,00/kg em 13/10"; nunca preenche sozinha
  // — RN-NEG-020). Grupos: os 7 nomes de categoria (D-38) e categoria + raça.
  r.get(
    "/trades/last-prices",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Último preço usado por categoria (referência)",
        querystring: lastPricesQuerySchema,
      },
    },
    async (request) => {
      const { type, priceUnit, arrobaBasis } = request.query;
      const items = await request.db.tradeItem.findMany({
        where: {
          type,
          priceAdjusted: false, // preço da categoria, não o ajuste de um animal
          trade: { priceUnit, ...(priceUnit === "PER_ARROBA" ? { arrobaBasis: arrobaBasis ?? null } : {}) },
        },
        orderBy: [{ trade: { date: "desc" } }, { createdAt: "desc" }],
        take: 2000,
        select: {
          unitPrice: true,
          trade: { select: { date: true } },
          animal: { select: { category: true, sex: true, breed: true } },
        },
      });

      const byCategory = new Map<string, { group: string; unitPrice: string; date: string }>();
      const byCategoryAndBreed = new Map<string, { group: string; breed: string | null; unitPrice: string; date: string }>();
      for (const item of items) {
        const group = categoryLabelKey(item.animal.category, item.animal.sex);
        const unitPrice = item.unitPrice.toFixed(2);
        const date = calendarDateOf(item.trade.date);
        if (!byCategory.has(group)) byCategory.set(group, { group, unitPrice, date });
        const breed = item.animal.breed?.trim() || null;
        const key = `${group}|${breed?.toLocaleLowerCase("pt-BR") ?? ""}`;
        if (!byCategoryAndBreed.has(key)) byCategoryAndBreed.set(key, { group, breed, unitPrice, date });
      }
      return { byCategory: [...byCategory.values()], byCategoryAndBreed: [...byCategoryAndBreed.values()] };
    },
  );

  // GET /trades/:id — detalhe com os animais e os valores
  r.get(
    "/trades/:id",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Detalhe de uma negociação",
        params: tradeIdParamSchema,
      },
    },
    async (request) => {
      const trade = await findTradeDetail(request.db, { id: request.params.id });
      if (!trade) throw tradeNotFound();
      return toTradeView(trade);
    },
  );

  // PATCH /trades/:id — corrige data, forma de preço, preços, pesos (inclusive
  // o peso de carcaça que chegou depois — D-35), comprador e observações.
  // Os itens são indicados pelo id; o servidor recalcula tudo.
  r.patch(
    "/trades/:id",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Corrige uma negociação (recalcula valores)",
        params: tradeIdParamSchema,
        body: updateTradeSchema,
      },
    },
    async (request) => {
      const farm = request.auth.farm;
      const body = request.body;
      const trade = await request.db.trade.findUnique({
        where: { id: request.params.id },
        include: {
          items: {
            include: {
              animal: {
                select: { id: true, tag: true, status: true, exitDate: true, birthDate: true, birthPrecision: true },
              },
            },
            orderBy: { animal: { tag: "asc" } },
          },
        },
      });
      if (!trade) throw tradeNotFound();

      const oldDate = calendarDateOf(trade.date);
      const date = body.date ?? oldDate;
      if (body.date) assertNotInFuture(body.date, farm.timezone, "date", FUTURE_DATE);

      const pricing = resolvePricing(
        {
          priceUnit: body.priceUnit ?? trade.priceUnit,
          arrobaBasis: body.arrobaBasis !== undefined ? body.arrobaBasis : trade.arrobaBasis,
          arrobaFactorKg:
            body.arrobaFactorKg !== undefined ? body.arrobaFactorKg : (trade.arrobaFactorKg?.toFixed(2) ?? null),
        },
        farm.settings.arrobaLiveFactorKg,
        {
          arrobaBasis: body.arrobaBasis !== undefined && body.arrobaBasis !== null,
          arrobaFactorKg: body.arrobaFactorKg !== undefined && body.arrobaFactorKg !== null,
        },
      );

      // Itens enviados que não são desta negociação
      const known = new Set(trade.items.map((item) => item.id));
      const unknownErrors: FieldError[] = (body.items ?? []).flatMap((update, index) =>
        known.has(update.id)
          ? []
          : [{ field: `items.${index}.id`, code: ErrorCode.TRADE_ITEM_NOT_FOUND, error: "Item não encontrado." }],
      );
      if (unknownErrors.length > 0) throw tradeItemErrors(unknownErrors);

      // Junta o que existe com o que mudou. Os erros por linha usam a posição
      // na lista da negociação (a mesma ordem do GET: por brinco).
      const updates = new Map((body.items ?? []).map((update) => [update.id, update]));
      const carcassBasis = pricing.arrobaBasis === "CARCASS";
      const merged = trade.items.map((item) => {
        const update = updates.get(item.id);
        const current = {
          liveWeightKg: item.liveWeightKg?.toFixed(2) ?? null,
          carcassWeightKg: item.carcassWeightKg?.toFixed(2) ?? null,
        };
        const sentCarcass = update?.carcassWeightKg;
        return {
          item,
          liveWeightKg: update?.liveWeightKg !== undefined ? update.liveWeightKg : current.liveWeightKg,
          // Fora da arroba por carcaça, o peso de carcaça antigo deixa de valer
          // (se a pessoa mandar um novo, a regra recusa)
          carcassWeightKg:
            sentCarcass !== undefined ? sentCarcass : carcassBasis ? current.carcassWeightKg : null,
          unitPrice: update?.unitPrice ?? item.unitPrice.toFixed(2),
          priceAdjusted: update?.priceAdjusted ?? item.priceAdjusted,
        };
      });
      assertItemsFitPricing(pricing, merged);

      // Nova data: cada animal ainda pode estar nesta negociação nesse dia?
      const problems = await findAnimalProblems(
        request.db,
        trade.type,
        date,
        trade.items.map((item) => item.animal),
        trade.id,
      );
      const errors = merged.flatMap(({ item }, index) => {
        const problem = problems.get(item.animalId);
        return problem ? [problemToFieldError(index, item.animal.tag, problem)] : [];
      });
      if (errors.length > 0) throw tradeItemErrors(errors);

      const { updated, replaced } = await request.db.$transaction(async (tx) => {
        let replacedCount = 0;
        await tx.trade.update({
          where: { id: trade.id },
          data: {
            date: toDbDate(date),
            priceUnit: pricing.priceUnit,
            arrobaBasis: pricing.arrobaBasis,
            arrobaFactorKg: pricing.arrobaFactorKg,
            ...(body.counterparty !== undefined ? { counterparty: body.counterparty || null } : {}),
            ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
          },
        });

        for (const entry of merged) {
          const { item } = entry;
          const weightChanged = entry.liveWeightKg !== (item.liveWeightKg?.toFixed(2) ?? null);
          let weighingId = item.weighingId;
          if (date !== oldDate || weightChanged) {
            const synced = await syncItemWeighing(tx, farm.id, trade.type, date, {
              animalId: item.animalId,
              weighingId: item.weighingId,
              liveWeightKg: entry.liveWeightKg,
            });
            weighingId = synced.weighingId;
            if (synced.replaced) replacedCount += 1;
          }
          await tx.tradeItem.update({
            where: { id: item.id },
            data: {
              liveWeightKg: entry.liveWeightKg,
              carcassWeightKg: entry.carcassWeightKg,
              unitPrice: entry.unitPrice,
              priceAdjusted: entry.priceAdjusted,
              value: itemValue(pricing, entry),
              weighingId,
            },
          });
        }

        // Venda com nova data: a saída dos animais acompanha. Compra com nova
        // data: a entrada que a compra preencheu acompanha (D-52)
        if (date !== oldDate) {
          const actor = actorOf(request.auth);
          const animalIds = trade.items.map((item) => item.animalId);
          if (trade.type === "SALE") {
            await updateAnimalsWithHistory(tx, actor, animalIds, { exitDate: toDbDate(date) });
          } else {
            const filled = await tx.animal.findMany({
              where: { id: { in: animalIds }, origin: "PURCHASED", entryDate: toDbDate(oldDate) },
              select: { id: true },
            });
            await updateAnimalsWithHistory(tx, actor, filled.map((animal) => animal.id), { entryDate: toDbDate(date) });
          }
        }

        const fresh = await tx.trade.findUniqueOrThrow({ where: { id: trade.id }, include: TRADE_DETAIL_INCLUDE });
        return { updated: fresh, replaced: replacedCount };
      }, TRANSACTION_OPTIONS);

      return { ...toTradeView(updated), replacedWeighings: replaced };
    },
  );

  // DELETE /trades/:id/items/:itemId — tira um animal da negociação (embarcou
  // errado). Venda: o animal volta a ativo. A pesagem do item é apagada. Se era
  // o último animal, a negociação deixa de existir.
  r.delete(
    "/trades/:id/items/:itemId",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Tira um animal da negociação",
        params: tradeItemParamsSchema,
      },
    },
    async (request) => {
      const { id, itemId } = request.params;
      const item = await request.db.tradeItem.findFirst({
        where: { id: itemId, tradeId: id },
        select: {
          id: true,
          animalId: true,
          type: true,
          weighingId: true,
          animal: { select: { tag: true } },
          trade: { select: { date: true } },
        },
      });
      if (!item) {
        const trade = await request.db.trade.findUnique({ where: { id }, select: { id: true } });
        if (!trade) throw tradeNotFound();
        throw notFound(ErrorCode.TRADE_ITEM_NOT_FOUND, "Este animal não está nesta negociação.");
      }

      const actor = actorOf(request.auth);
      const tradeDeleted = await request.db.$transaction(async (tx) => {
        await revertItems(tx, actor, calendarDateOf(item.trade.date), [item]);
        const remaining = await tx.tradeItem.count({ where: { tradeId: id } });
        if (remaining === 0) await tx.trade.deleteMany({ where: { id } });
        // Trilha (D-51): animal tirado da negociação
        await recordAudit(tx, actor, {
          action: remaining === 0 ? AuditAction.TRADE_UNDONE : AuditAction.TRADE_ITEM_REMOVED,
          entityType: "Trade",
          entityId: id,
          details: { type: item.type, date: calendarDateOf(item.trade.date), tags: [item.animal.tag] },
        });
        return remaining === 0;
      }, TRANSACTION_OPTIONS);

      return { tradeDeleted };
    },
  );

  // DELETE /trades/:id — desfaz a negociação inteira (todos os animais voltam)
  r.delete(
    "/trades/:id",
    {
      schema: {
        tags: ["Negociações"],
        summary: "Desfaz uma negociação inteira",
        params: tradeIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const actor = actorOf(request.auth);
      const found = await request.db.$transaction(async (tx) => {
        const trade = await tx.trade.findUnique({
          where: { id },
          select: {
            type: true,
            date: true,
            items: {
              select: { id: true, animalId: true, type: true, weighingId: true, animal: { select: { tag: true } } },
            },
          },
        });
        if (!trade) return false;
        await revertItems(tx, actor, calendarDateOf(trade.date), trade.items);
        await tx.trade.deleteMany({ where: { id } });
        // Trilha (D-51): negociação desfeita
        await recordAudit(tx, actor, {
          action: AuditAction.TRADE_UNDONE,
          entityType: "Trade",
          entityId: id,
          details: { type: trade.type, date: calendarDateOf(trade.date), tags: trade.items.map((item) => item.animal.tag) },
        });
        return true;
      }, TRANSACTION_OPTIONS);

      if (!found) throw tradeNotFound();
      return reply.status(204).send();
    },
  );
}

// Filtros da lista e do resumo: tipo, período, pendente e busca
// (comprador/vendedor ou brinco de um animal)
function tradeFilter(filters: {
  type?: "SALE" | "PURCHASE";
  from?: string;
  to?: string;
  pending?: boolean;
  q?: string;
}): Prisma.TradeWhereInput {
  const { type, from, to, pending, q } = filters;
  return {
    ...(type ? { type } : {}),
    ...(from || to ? { date: { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) } } : {}),
    ...(pending === true ? { items: { some: { value: null } } } : {}),
    ...(pending === false ? { items: { none: { value: null } } } : {}),
    ...(q
      ? {
          OR: [
            { counterparty: { contains: q, mode: "insensitive" } },
            { items: { some: { animal: { tag: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };
}
