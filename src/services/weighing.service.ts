import type { FarmDb } from "../lib/tenant.js";
import { calendarDateOf } from "../lib/dates.js";

// Resultado do cálculo de desempenho de um animal
export type WeightGainResult = {
  firstWeightKg: number;
  lastWeightKg: number;
  totalGainKg: number;
  days: number;
  averageDailyGainKg: number;
  // Período do GMD (RN-PES-007): sempre mostrado junto com o valor
  startDate: string; // AAAA-MM-DD da primeira pesagem
  endDate: string; // AAAA-MM-DD da última
};

// Por que o GMD não pôde ser calculado
export type WeightGainUnavailableReason =
  | "INSUFFICIENT_WEIGHINGS" // menos de 2 pesagens
  | "SAME_DAY_WEIGHINGS"; // primeira e última pesagem no mesmo dia (F-09)

export type WeightGainOutcome =
  | { ok: true; value: WeightGainResult }
  | { ok: false; reason: WeightGainUnavailableReason };

// Uma pesagem "simples" — só o que o cálculo precisa (data e peso)
export type WeighingInput = {
  date: Date;
  weightKg: number | string;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// A CONTA PURA: recebe as pesagens já prontas e calcula. Não depende do banco.
export function computeWeightGain(weighings: WeighingInput[]): WeightGainOutcome {
  if (weighings.length < 2) {
    return { ok: false, reason: "INSUFFICIENT_WEIGHINGS" };
  }

  // ordena por data, da mais antiga pra mais recente
  const sorted = [...weighings].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const days = Math.round(
    (last.date.getTime() - first.date.getTime()) / MS_PER_DAY,
  );

  // Ganho "em 0 dias" não é um GMD: não calcula, em vez de mostrar 0 (F-09).
  if (days <= 0) {
    return { ok: false, reason: "SAME_DAY_WEIGHINGS" };
  }

  const firstWeightKg = Number(first.weightKg);
  const lastWeightKg = Number(last.weightKg);
  // arredonda para 2 casas (o peso é guardado com 2 casas)
  const totalGainKg = Number((lastWeightKg - firstWeightKg).toFixed(2));

  return {
    ok: true,
    value: {
      firstWeightKg,
      lastWeightKg,
      totalGainKg,
      days,
      averageDailyGainKg: Number((totalGainKg / days).toFixed(3)),
      startDate: calendarDateOf(first.date),
      endDate: calendarDateOf(last.date),
    },
  };
}

// "Ganho desde a anterior" (RN-PES-008): a mesma conta do GMD aplicada a cada
// par de pesagens seguidas. Informação, não indicador novo. A primeira
// pesagem não tem anterior (null). Devolve na mesma ordem recebida.
export type GainSincePrevious = { gainKg: number; days: number; dailyGainKg: number | null } | null;

export function gainsSincePrevious(weighings: WeighingInput[]): GainSincePrevious[] {
  const order = weighings.map((weighing, index) => ({ weighing, index }));
  order.sort((a, b) => a.weighing.date.getTime() - b.weighing.date.getTime());
  const result: GainSincePrevious[] = new Array(weighings.length).fill(null);
  for (let position = 1; position < order.length; position += 1) {
    const previous = order[position - 1].weighing;
    const current = order[position].weighing;
    const days = Math.round((current.date.getTime() - previous.date.getTime()) / MS_PER_DAY);
    const gainKg = Number((Number(current.weightKg) - Number(previous.weightKg)).toFixed(2));
    result[order[position].index] = { gainKg, days, dailyGainKg: days > 0 ? Number((gainKg / days).toFixed(3)) : null };
  }
  return result;
}

// A função que fala com o banco: busca as pesagens e chama a conta pura acima.
export async function calculateWeightGain(
  db: FarmDb,
  animalId: string,
): Promise<WeightGainOutcome> {
  const weighings = await db.weighing.findMany({
    where: { animalId },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true },
  });

  // converte as pesagens do banco pro formato simples que a conta pura espera
  return computeWeightGain(
    weighings.map((w) => ({ date: w.date, weightKg: Number(w.weightKg) })),
  );
}
