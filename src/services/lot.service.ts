import { computeWeightGain, type WeighingInput } from "./weighing.service.js";
// Lotes (D-49) — regras puras, testadas em lot.service.test.ts.
// Datas "AAAA-MM-DD" (comparáveis como texto).

export type LotMoveProblem =
  | "ANIMAL_NOT_ACTIVE" // vendido ou morto não muda de lote
  | "LOT_DATE_OUT_OF_LIFE" // antes do nascimento (dia certo) ou depois da saída
  | "LOT_DATE_BEFORE_CURRENT"; // antes de entrar no lote atual (os períodos não se cruzam)

export type LotMovePlan = { kind: "MOVE" } | { kind: "UNCHANGED" } | { kind: "PROBLEM"; problem: LotMoveProblem };

// O que fazer com um animal ao mover para `targetLotId` (null = tirar do lote)
export function planLotMove(input: {
  targetLotId: string | null;
  date: string;
  active: boolean;
  outsideLife: boolean;
  open: { lotId: string; startDate: string } | null;
}): LotMovePlan {
  const sameLot = (input.open?.lotId ?? null) === input.targetLotId;
  if (sameLot) return { kind: "UNCHANGED" }; // já está lá (ou já sem lote): nada a fazer
  if (!input.active) return { kind: "PROBLEM", problem: "ANIMAL_NOT_ACTIVE" };
  if (input.outsideLife) return { kind: "PROBLEM", problem: "LOT_DATE_OUT_OF_LIFE" };
  // A troca fecha o período atual na data: ela não pode ser antes da entrada
  if (input.open && input.date < input.open.startDate) return { kind: "PROBLEM", problem: "LOT_DATE_BEFORE_CURRENT" };
  return { kind: "MOVE" };
}

// ── Resumo do lote (tela do lote, 2026-10-21) ──
// Regras (docs/architecture.md, "Lotes"):
// - peso médio = média do ÚLTIMO peso de cada animal que está no lote agora e
//   tem pesagem (de qualquer data); a data mostrada é a mais recente delas;
// - GMD no lote = para cada animal, a mesma conta da ficha usando só as
//   pesagens DESDE a entrada no lote; média dos animais que têm GMD. O período
//   vai da primeira à última pesagem usada. Sem nenhum: nulo, nunca zero.

export type LotAnimalInput = {
  sex: "MALE" | "FEMALE";
  since: string; // AAAA-MM-DD
  weighings: { date: string; weightKg: number }[];
};

export type LotSummary = {
  males: number;
  females: number;
  averageWeightKg: number | null;
  weighedAnimals: number;
  lastWeighingDate: string | null;
  gain: {
    averageDailyGainKg: number | null;
    animalsWithGain: number;
    animalsWithoutGain: number;
    from: string | null;
    to: string | null;
  };
};

const toInput = (weighing: { date: string; weightKg: number }): WeighingInput => ({
  date: new Date(`${weighing.date}T00:00:00.000Z`),
  weightKg: weighing.weightKg,
});

export function summarizeLot(animals: LotAnimalInput[]): LotSummary {
  let weightSum = 0;
  let weighed = 0;
  let lastDate: string | null = null;
  let gainSum = 0;
  let withGain = 0;
  let from: string | null = null;
  let to: string | null = null;

  for (const animal of animals) {
    const sorted = [...animal.weighings].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    if (last) {
      weightSum += last.weightKg;
      weighed += 1;
      if (!lastDate || last.date > lastDate) lastDate = last.date;
    }
    const inLot = sorted.filter((weighing) => weighing.date >= animal.since);
    const outcome = computeWeightGain(inLot.map(toInput));
    if (outcome.ok) {
      gainSum += outcome.value.averageDailyGainKg;
      withGain += 1;
      if (!from || outcome.value.startDate < from) from = outcome.value.startDate;
      if (!to || outcome.value.endDate > to) to = outcome.value.endDate;
    }
  }

  return {
    males: animals.filter((animal) => animal.sex === "MALE").length,
    females: animals.filter((animal) => animal.sex === "FEMALE").length,
    averageWeightKg: weighed === 0 ? null : Number((weightSum / weighed).toFixed(1)),
    weighedAnimals: weighed,
    lastWeighingDate: lastDate,
    gain: {
      averageDailyGainKg: withGain === 0 ? null : Number((gainSum / withGain).toFixed(3)),
      animalsWithGain: withGain,
      animalsWithoutGain: animals.length - withGain,
      from,
      to,
    },
  };
}

// Uma data está dentro de um período do animal no lote? (fim aberto = até hoje)
export function withinMembership(date: string, membership: { startDate: string; endDate: string | null }) {
  return date >= membership.startDate && (membership.endDate === null || date <= membership.endDate);
}
