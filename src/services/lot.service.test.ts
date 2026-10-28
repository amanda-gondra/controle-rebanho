import { describe, expect, it } from "vitest";
import { planLotMove, summarizeLot, withinMembership } from "./lot.service.js";

const base = { targetLotId: "B", date: "2026-05-10", active: true, outsideLife: false, open: null };

describe("planLotMove (D-49)", () => {
  it("sem lote → entra", () => {
    expect(planLotMove(base)).toEqual({ kind: "MOVE" });
  });

  it("já está no lote → nada muda (não duplica período)", () => {
    expect(planLotMove({ ...base, open: { lotId: "B", startDate: "2026-01-01" } })).toEqual({ kind: "UNCHANGED" });
    expect(planLotMove({ ...base, targetLotId: null })).toEqual({ kind: "UNCHANGED" });
  });

  it("troca de lote na data, nunca antes da entrada no atual", () => {
    expect(planLotMove({ ...base, open: { lotId: "A", startDate: "2026-05-10" } })).toEqual({ kind: "MOVE" });
    expect(planLotMove({ ...base, open: { lotId: "A", startDate: "2026-05-11" } })).toEqual({
      kind: "PROBLEM",
      problem: "LOT_DATE_BEFORE_CURRENT",
    });
  });

  it("vendido/morto ou fora da vida do animal → recusado", () => {
    expect(planLotMove({ ...base, active: false })).toEqual({ kind: "PROBLEM", problem: "ANIMAL_NOT_ACTIVE" });
    expect(planLotMove({ ...base, outsideLife: true })).toEqual({ kind: "PROBLEM", problem: "LOT_DATE_OUT_OF_LIFE" });
  });
});

describe("summarizeLot — resumo do lote", () => {
  const w = (date: string, weightKg: number) => ({ date, weightKg });

  it("conta machos e fêmeas; peso médio pelo último peso de cada animal", () => {
    const summary = summarizeLot([
      { sex: "MALE", since: "2026-09-01", weighings: [w("2026-08-01", 200), w("2026-10-01", 300)] },
      { sex: "FEMALE", since: "2026-09-01", weighings: [w("2026-10-05", 280)] },
      { sex: "FEMALE", since: "2026-09-01", weighings: [] },
    ]);
    expect(summary).toMatchObject({ males: 1, females: 2, averageWeightKg: 290, weighedAnimals: 2, lastWeighingDate: "2026-10-05" });
  });

  it("GMD no lote usa só as pesagens desde a entrada", () => {
    const summary = summarizeLot([
      // antes da entrada (01/09) não conta: 300 (01/09) → 330 (01/10) = 1,000
      { sex: "MALE", since: "2026-09-01", weighings: [w("2026-06-01", 100), w("2026-09-01", 300), w("2026-10-01", 330)] },
      // só uma pesagem no lote: sem GMD
      { sex: "MALE", since: "2026-09-15", weighings: [w("2026-09-01", 250), w("2026-09-20", 260)] },
    ]);
    expect(summary.gain).toEqual({ averageDailyGainKg: 1, animalsWithGain: 1, animalsWithoutGain: 1, from: "2026-09-01", to: "2026-10-01" });
  });

  it("lote vazio ou sem pesagens: nada de zero inventado", () => {
    expect(summarizeLot([])).toMatchObject({ averageWeightKg: null, lastWeighingDate: null, gain: { averageDailyGainKg: null, from: null } });
  });
});

describe("withinMembership", () => {
  it("dentro do período, inclusive nas pontas; período aberto vai até hoje", () => {
    expect(withinMembership("2026-09-01", { startDate: "2026-09-01", endDate: "2026-09-30" })).toBe(true);
    expect(withinMembership("2026-09-30", { startDate: "2026-09-01", endDate: "2026-09-30" })).toBe(true);
    expect(withinMembership("2026-10-01", { startDate: "2026-09-01", endDate: "2026-09-30" })).toBe(false);
    expect(withinMembership("2030-01-01", { startDate: "2026-09-01", endDate: null })).toBe(true);
  });
});
