import { describe, expect, it } from "vitest";
import { averageHerdGain, periodDays, resolvePeriod } from "./dashboard.service.js";

const w = (date: string, weightKg: number) => ({ date: new Date(`${date}T00:00:00.000Z`), weightKg });

describe("resolvePeriod — período do painel", () => {
  it("sem datas: do dia 1º do mês até hoje", () => {
    expect(resolvePeriod("2026-10-18")).toEqual({ from: "2026-10-01", to: "2026-10-18" });
  });

  it("fim no futuro vira hoje", () => {
    expect(resolvePeriod("2026-10-18", "2026-09-01", "2026-12-31")).toEqual({ from: "2026-09-01", to: "2026-10-18" });
  });

  it("período informado é respeitado", () => {
    expect(resolvePeriod("2026-10-18", "2026-01-01", "2026-06-30")).toEqual({ from: "2026-01-01", to: "2026-06-30" });
  });

  it("sem início: dia 1º do mês do fim", () => {
    expect(resolvePeriod("2026-10-18", undefined, "2026-03-15")).toEqual({ from: "2026-03-01", to: "2026-03-15" });
  });
});

describe("periodDays", () => {
  it("conta os dois extremos", () => {
    expect(periodDays({ from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(periodDays({ from: "2026-10-18", to: "2026-10-18" })).toBe(1);
  });
});

describe("averageHerdGain — GMD médio dos animais ativos", () => {
  it("média simples do GMD de cada animal (primeira → última pesagem)", () => {
    const result = averageHerdGain([
      [w("2026-01-01", 200), w("2026-01-11", 210)], // 1,000 kg/dia
      [w("2026-01-01", 300), w("2026-01-21", 310)], // 0,500 kg/dia
    ]);
    expect(result).toEqual({ averageDailyGainKg: 0.75, animalsWithGain: 2, animalsWithoutGain: 0 });
  });

  it("animal sem 2 pesagens ou com pesagens no mesmo dia fica de fora e é contado à parte", () => {
    const result = averageHerdGain([[w("2026-01-01", 200), w("2026-01-11", 210)], [w("2026-01-01", 300)], [], [w("2026-02-01", 1), w("2026-02-01", 2)]]);
    expect(result).toEqual({ averageDailyGainKg: 1, animalsWithGain: 1, animalsWithoutGain: 3 });
  });

  it("nenhum animal com GMD: média nula, nunca zero", () => {
    expect(averageHerdGain([[w("2026-01-01", 200)]])).toEqual({ averageDailyGainKg: null, animalsWithGain: 0, animalsWithoutGain: 1 });
    expect(averageHerdGain([])).toEqual({ averageDailyGainKg: null, animalsWithGain: 0, animalsWithoutGain: 0 });
  });

  it("perda de peso entra como GMD negativo (não é escondida)", () => {
    expect(averageHerdGain([[w("2026-01-01", 210), w("2026-01-11", 200)]]).averageDailyGainKg).toBe(-1);
  });
});
