import { prisma } from "../lib/prisma.js";

// Resultado do cálculo de desempenho de um animal
export type WeightGainResult = {
  firstWeightKg: number;
  lastWeightKg: number;
  totalGainKg: number;
  days: number;
  averageDailyGainKg: number;
};

// Calcula o ganho de peso e o GMD de um animal a partir das suas pesagens.
// Retorna null se não houver pesagens suficientes (mínimo 2) pra calcular.
export async function calculateWeightGain(
  animalId: string,
): Promise<WeightGainResult | null> {
  // busca as pesagens do animal, da mais antiga pra mais recente
  const weighings = await prisma.weighing.findMany({
    where: { animalId },
    orderBy: { date: "asc" },
  });

  // precisa de pelo menos 2 pontos pra calcular uma evolução
  if (weighings.length < 2) {
    return null;
  }

  const first = weighings[0];
  const last = weighings[weighings.length - 1];

  // Decimal do Prisma vem como texto/objeto — converte pra número pra calcular
  const firstWeightKg = Number(first.weightKg);
  const lastWeightKg = Number(last.weightKg);

  const totalGainKg = lastWeightKg - firstWeightKg;

  // diferença de dias entre a primeira e a última pesagem
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round(
    (last.date.getTime() - first.date.getTime()) / msPerDay,
  );

  // GMD = ganho total dividido pelos dias (evita divisão por zero)
  const averageDailyGainKg = days > 0 ? totalGainKg / days : 0;

  return {
    firstWeightKg,
    lastWeightKg,
    totalGainKg,
    days,
    averageDailyGainKg: Number(averageDailyGainKg.toFixed(3)),
  };
}