import { describe, it, expect } from "vitest";
import { gainsSincePrevious, computeWeightGain, type WeightGainOutcome } from "./weighing.service.js";

// Ajudante: garante que o cálculo deu certo e devolve o valor
function valueOf(outcome: WeightGainOutcome) {
  if (!outcome.ok) throw new Error(`esperava cálculo, veio ${outcome.reason}`);
  return outcome.value;
}

describe("computeWeightGain", () => {
  it("calcula ganho e GMD com duas pesagens", () => {
    const result = valueOf(
      computeWeightGain([
        { date: new Date("2024-06-01"), weightKg: 180 },
        { date: new Date("2024-12-01"), weightKg: 300 },
      ]),
    );

    expect(result.firstWeightKg).toBe(180);
    expect(result.lastWeightKg).toBe(300);
    expect(result.totalGainKg).toBe(120);
    expect(result.days).toBe(183);
    expect(result.averageDailyGainKg).toBe(0.656);
  });

  it("ordena as pesagens mesmo se vierem fora de ordem", () => {
    const result = valueOf(
      computeWeightGain([
        { date: new Date("2024-12-01"), weightKg: 300 },
        { date: new Date("2024-06-01"), weightKg: 180 },
      ]),
    );

    // mesmo passando a mais recente primeiro, deve pegar 180 como inicial
    expect(result.firstWeightKg).toBe(180);
    expect(result.lastWeightKg).toBe(300);
  });

  it("não calcula com menos de duas pesagens", () => {
    const result = computeWeightGain([
      { date: new Date("2024-06-01"), weightKg: 180 },
    ]);

    expect(result).toEqual({ ok: false, reason: "INSUFFICIENT_WEIGHINGS" });
  });

  it("não calcula sem nenhuma pesagem", () => {
    expect(computeWeightGain([])).toEqual({
      ok: false,
      reason: "INSUFFICIENT_WEIGHINGS",
    });
  });

  it("não calcula GMD quando a primeira e a última pesagem são no mesmo dia (F-09)", () => {
    const result = computeWeightGain([
      { date: new Date("2024-06-01"), weightKg: 180 },
      { date: new Date("2024-06-01"), weightKg: 190 },
    ]);

    expect(result).toEqual({ ok: false, reason: "SAME_DAY_WEIGHINGS" });
  });

  it("aceita peso como texto (vindo do Prisma) e calcula certo", () => {
    const result = valueOf(
      computeWeightGain([
        { date: new Date("2024-01-01"), weightKg: "200.00" },
        { date: new Date("2024-01-11"), weightKg: "250.00" },
      ]),
    );

    expect(result.totalGainKg).toBe(50);
    expect(result.days).toBe(10);
    expect(result.averageDailyGainKg).toBe(5); // 50kg / 10 dias
  });

  it("perda de peso sai negativa", () => {
    const result = valueOf(
      computeWeightGain([
        { date: new Date("2024-01-01"), weightKg: 300 },
        { date: new Date("2024-01-11"), weightKg: 290.5 },
      ]),
    );

    expect(result.totalGainKg).toBe(-9.5);
    expect(result.averageDailyGainKg).toBe(-0.95);
  });
});


describe("período e ganho desde a anterior (RN-PES-007/008)", () => {
  const w = (date: string, weightKg: number) => ({ date: new Date(`${date}T00:00:00.000Z`), weightKg });

  it("GMD traz as datas do período (critério 2)", () => {
    const outcome = computeWeightGain([w("2024-12-01", 300), w("2024-06-01", 180)]);
    expect(outcome).toEqual({
      ok: true,
      value: {
        firstWeightKg: 180,
        lastWeightKg: 300,
        totalGainKg: 120,
        days: 183,
        averageDailyGainKg: 0.656,
        startDate: "2024-06-01",
        endDate: "2024-12-01",
      },
    });
  });

  it("ganho desde a anterior, na ordem recebida (mais recente primeiro)", () => {
    const gains = gainsSincePrevious([w("2024-12-01", 300), w("2024-09-01", 240), w("2024-06-01", 180)]);
    expect(gains).toEqual([
      { gainKg: 60, days: 91, dailyGainKg: 0.659 },
      { gainKg: 60, days: 92, dailyGainKg: 0.652 },
      null,
    ]);
  });
});
