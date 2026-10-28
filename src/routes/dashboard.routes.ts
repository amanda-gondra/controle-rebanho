import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { calendarDateOf, toDbDate, todayInTimeZone } from "../lib/dates.js";
import { ErrorCode, ruleError } from "../lib/errors.js";
import { openReminders } from "../lib/reminders.js";
import { MAX_DASHBOARD_PERIOD_DAYS, dashboardQuerySchema } from "../schemas/dashboard.schema.js";
import { averageHerdGain, periodDays, resolvePeriod } from "../services/dashboard.service.js";
import type { WeighingInput } from "../services/weighing.service.js";

// GET /dashboard — painel mínimo (D-50). Só números reais da fazenda da sessão,
// cada um com a regra escrita em docs/architecture.md ("Painel"):
// - rebanho: animais ATIVOS agora, por categoria e por lote;
// - período: entradas pela DATA DE ENTRADA (por origem), vendas e mortes pela
//   DATA DE SAÍDA, pesagens pela data da pesagem;
// - lembretes: os mesmos de GET /alerts (vencidos e chegando);
// - GMD médio: média do GMD de cada animal ativo que tem GMD (regra da ficha).
export async function dashboardRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/dashboard",
    {
      schema: {
        tags: ["Painel"],
        summary: "Números do rebanho (agora) e do período (padrão: mês corrente)",
        querystring: dashboardQuerySchema,
      },
    },
    async (request) => {
      const db = request.db;
      const today = todayInTimeZone(request.auth.farm.timezone);
      const period = resolvePeriod(today, request.query.from, request.query.to);
      if (period.from > period.to) {
        throw ruleError(ErrorCode.VALIDATION_ERROR, "Período inválido.", [
          { field: "from", code: "PERIOD_INVALID", error: "A data inicial não pode ser depois de hoje." },
        ], 400);
      }
      if (periodDays(period) > MAX_DASHBOARD_PERIOD_DAYS) {
        throw ruleError(ErrorCode.VALIDATION_ERROR, "Período longo demais.", [
          { field: "from", code: "PERIOD_TOO_LONG", params: { max: MAX_DASHBOARD_PERIOD_DAYS }, error: "Período longo demais." },
        ], 400);
      }
      const range = { gte: toDbDate(period.from), lte: toDbDate(period.to) };

      const [active, byCategory, lotGroups, entries, sold, died, weighingsInPeriod, weighedAnimals, recent, activeWeighings, reminders] =
        await Promise.all([
          db.animal.count({ where: { status: "ACTIVE" } }),
          db.animal.groupBy({ by: ["category", "sex"], where: { status: "ACTIVE" }, _count: { _all: true } }),
          db.lotMembership.groupBy({
            by: ["lotId"],
            where: { endDate: null, animal: { status: "ACTIVE" } },
            _count: { _all: true },
          }),
          db.animal.groupBy({ by: ["origin"], where: { entryDate: range }, _count: { _all: true } }),
          db.animal.count({ where: { status: "SOLD", exitDate: range } }),
          db.animal.count({ where: { status: "DEAD", exitDate: range } }),
          db.weighing.count({ where: { date: range } }),
          db.weighing.groupBy({ by: ["animalId"], where: { date: range } }),
          db.weighing.findMany({
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 5,
            select: { id: true, date: true, weightKg: true, animal: { select: { id: true, tag: true } } },
          }),
          db.weighing.findMany({
            where: { animal: { status: "ACTIVE" } },
            select: { animalId: true, date: true, weightKg: true },
          }),
          openReminders(db, request.auth.farm),
        ]);

      const lots = await db.lot.findMany({
        where: { id: { in: lotGroups.map((group) => group.lotId) } },
        select: { id: true, name: true },
      });
      const lotName = new Map(lots.map((lot) => [lot.id, lot.name]));
      const inLots = lotGroups.reduce((sum, group) => sum + group._count._all, 0);

      const byAnimal = new Map<string, WeighingInput[]>();
      for (const weighing of activeWeighings) {
        const list = byAnimal.get(weighing.animalId) ?? [];
        list.push({ date: weighing.date, weightKg: weighing.weightKg.toString() });
        byAnimal.set(weighing.animalId, list);
      }
      const gain = averageHerdGain([...byAnimal.values()]);

      return {
        period,
        today,
        herd: {
          active,
          byCategory: byCategory
            .map((group) => ({ category: group.category, sex: group.sex, count: group._count._all }))
            .sort((a, b) => b.count - a.count),
          byLot: lotGroups
            .map((group) => ({ lotId: group.lotId, name: lotName.get(group.lotId) ?? "", count: group._count._all }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
          withoutLot: active - inLots,
        },
        movements: {
          entries: Object.fromEntries(entries.map((group) => [group.origin, group._count._all])),
          entriesTotal: entries.reduce((sum, group) => sum + group._count._all, 0),
          sold,
          died,
        },
        reminders: {
          overdue: reminders.filter((reminder) => reminder.overdue).length,
          upcoming: reminders.filter((reminder) => !reminder.overdue).length,
          alertDays: request.auth.farm.settings.reapplyAlertDays,
        },
        weighings: {
          inPeriod: weighingsInPeriod,
          animalsWeighed: weighedAnimals.length,
          recent: recent.map((weighing) => ({
            id: weighing.id,
            date: calendarDateOf(weighing.date),
            weightKg: weighing.weightKg.toString(),
            animal: weighing.animal,
          })),
        },
        gain: {
          ...gain,
          // ativos sem nenhuma pesagem também ficam sem GMD
          animalsWithoutGain: active - gain.animalsWithGain,
        },
      };
    },
  );
}
