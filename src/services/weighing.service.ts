import { prisma } from "../lib/prisma.js";

// Resultado do cálculo de desempenho de um animal
export type WeightGainResult = {
  firstWeightKg: number;
  lastWeightKg: number;
  totalGainKg: number;
  days: number;
  averageDailyGainKg: number;
};

// Uma pesagem "simples" — só o que o cálculo precisa (data e peso)
export type WeighingInput = {
  date: Date;
  weightKg: number | string;
};

// A CONTA PURA: recebe as pesagens já prontas e calcula. Não depende do banco.
// Retorna null se não houver pesagens suficientes (mínimo 2).
export function computeWeightGain(
  weighings: WeighingInput[],
): WeightGainResult | null {
  if (weighings.length < 2) {
    return null;
  }

  // ordena por data, da mais antiga pra mais recente
  const sorted = [...weighings].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const firstWeightKg = Number(first.weightKg);
  const lastWeightKg = Number(last.weightKg);
  const totalGainKg = lastWeightKg - firstWeightKg;

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round(
    (last.date.getTime() - first.date.getTime()) / msPerDay,
  );

  const averageDailyGainKg = days > 0 ? totalGainKg / days : 0;

  return {
    firstWeightKg,
    lastWeightKg,
    totalGainKg,
    days,
    averageDailyGainKg: Number(averageDailyGainKg.toFixed(3)),
  };
}

// A função que fala com o banco: busca as pesagens e chama a conta pura acima.
export async function calculateWeightGain(
  animalId: string,
): Promise<WeightGainResult | null> {
  const weighings = await prisma.weighing.findMany({
    where: { animalId },
    orderBy: { date: "asc" },
  });

  // converte as pesagens do banco pro formato simples que a conta pura espera
  return computeWeightGain(
    weighings.map((w) => ({
      date: w.date,
      weightKg: Number(w.weightKg),
    })),
  );

}