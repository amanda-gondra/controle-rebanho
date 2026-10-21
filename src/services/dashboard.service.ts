import { addDays } from "../lib/dates.js";
import { computeWeightGain, type WeighingInput } from "./weighing.service.js";

// Painel mínimo (D-50) — as regras de cada número, testadas em
// dashboard.service.test.ts e escritas em docs/architecture.md. Nada aqui é
// estimado: cada número é uma contagem ou uma média de valores já calculados
// pela mesma regra da ficha do animal.

export type Period = { from: string; to: string };

// Período padrão = do dia 1º do mês corrente até hoje (fuso da fazenda).
// Datas "AAAA-MM-DD" comparam como texto.
export function resolvePeriod(today: string, from?: string, to?: string): Period {
  const end = to && to < today ? to : today;
  const start = from ?? `${end.slice(0, 7)}-01`;
  return { from: start, to: end };
}

// Duração do período em dias, contando os dois extremos (1º a 31 = 31 dias)
export function periodDays(period: Period): number {
  let days = 1;
  for (let day = period.from; day < period.to; day = addDays(day, 1)) days += 1;
  return days;
}

// GMD médio do rebanho ativo: média simples do GMD de cada animal ativo que
// TEM GMD calculável (2+ pesagens em dias diferentes — mesma regra da ficha,
// primeira → última pesagem). Animais sem GMD ficam de fora e são contados à
// parte; com nenhum animal calculável, não há média (null), nunca zero.
export type HerdGain = {
  averageDailyGainKg: number | null;
  animalsWithGain: number;
  animalsWithoutGain: number;
};

export function averageHerdGain(weighingsByAnimal: WeighingInput[][]): HerdGain {
  let sum = 0;
  let withGain = 0;
  for (const weighings of weighingsByAnimal) {
    const outcome = computeWeightGain(weighings);
    if (!outcome.ok) continue;
    sum += outcome.value.averageDailyGainKg;
    withGain += 1;
  }
  return {
    averageDailyGainKg: withGain === 0 ? null : Number((sum / withGain).toFixed(3)),
    animalsWithGain: withGain,
    animalsWithoutGain: weighingsByAnimal.length - withGain,
  };
}
