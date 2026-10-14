import type { FastifyInstance } from "fastify";
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
  itemValue,
  problemToFieldError,
  resolvePricing,
  revertItems,
  syncItemWeighing,
  toTradeView,
  tradeItemErrors,
} from "../lib/trades.js";
import {
  createTradeSchema,
  lastPricesQuerySchema,
  listTradesQuerySchema,
  tradeIdParamSchema,
  tradeItemParamsSchema,
  updateTradeSchema,
} from "../schemas/trade.schema.js";
import { sumValues } from "../services/trade.service.js";

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
      const items = body.items.map((item) => ({
        animalId: item.animalId,
        liveWeightKg: item.liveWeightKg ?? null,
        carcassWeightKg: item.carcassWeightKg ?? null,
        unitPrice: item.unitPrice,
        priceAdjusted: item.priceAdjusted ?? false,
      }));
      assertItemsFitPricing(pricing, items);

      // Cada animal: existe nesta fazenda e pode entrar? Erros linha por linha.
      const animals = await request.db.animal.findMany({
        where: { id: { in: items.map((item) => item.animalId) } },
        select: { id: true, tag: true, status: true, exitDate: true, birthDate: true, birthPrecision: true },
      });
      const animalById = new Map(animals.map((animal) => [animal.id, animal]));
      const problems = await findAnimalProblems(request.db, body.type, body.date, animals);
      const errors: FieldError[] = [];
      items.forEach((item, index) => {
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

      try {
        const { trade, replaced } = await request.db.$transaction(async (tx) => {
          const plan = await createTradeWeighings(tx, farm.id, body.type, body.date, items);

          // Venda = saída: vendido, com a data da venda (RN-NEG-006)
          if (body.type === "SALE") {
            await tx.animal.updateMany({
              where: { id: { in: items.map((item) => item.animalId) } },
              data: {
                status: "SOLD",
                exitDate: toDbDate(body.date),
                deathCause: null,
                deathCauseCertainty: null,
              },
            });
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
        const isDuplicate = ["Trade", "TradeItem", "Weighing"].some((model) => uniqueViolation(error, model));
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
      const { type, from, to, pending, page, pageSize } = request.query;
      const where = {
        ...(type ? { type } : {}),
        ...(from || to
          ? { date: { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) } }
          : {}),
        ...(pending === true ? { items: { some: { value: null } } } : {}),
        ...(pending === false ? { items: { none: { value: null } } } : {}),
      };

      const [total, trades] = await Promise.all([
        request.db.trade.count({ where }),
        request.db.trade.findMany({
          where,
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { items: { select: { value: true } } },
        }),
      ]);

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
            total: sumValues(values),
            knownTotal: sumValues(values.map((value) => value ?? "0.00")),
            pending: values.some((value) => value === null),
          };
        }),
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

        // Venda com nova data: a saída dos animais acompanha
        if (trade.type === "SALE" && date !== oldDate) {
          await tx.animal.updateMany({
            where: { id: { in: trade.items.map((item) => item.animalId) } },
            data: { exitDate: toDbDate(date) },
          });
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
        select: { id: true, animalId: true, type: true, weighingId: true },
      });
      if (!item) {
        const trade = await request.db.trade.findUnique({ where: { id }, select: { id: true } });
        if (!trade) throw tradeNotFound();
        throw notFound(ErrorCode.TRADE_ITEM_NOT_FOUND, "Este animal não está nesta negociação.");
      }

      const tradeDeleted = await request.db.$transaction(async (tx) => {
        await revertItems(tx, [item]);
        const remaining = await tx.tradeItem.count({ where: { tradeId: id } });
        if (remaining === 0) await tx.trade.deleteMany({ where: { id } });
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
      const found = await request.db.$transaction(async (tx) => {
        const trade = await tx.trade.findUnique({
          where: { id },
          select: { items: { select: { id: true, animalId: true, type: true, weighingId: true } } },
        });
        if (!trade) return false;
        await revertItems(tx, trade.items);
        await tx.trade.deleteMany({ where: { id } });
        return true;
      }, TRANSACTION_OPTIONS);

      if (!found) throw tradeNotFound();
      return reply.status(204).send();
    },
  );
}
