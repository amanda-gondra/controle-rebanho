import { describe, it, expect } from "vitest";
import { computeWeightGain } from "./weighing.service.js";

describe("computeWeightGain", () => {
  it("calcula ganho e GMD com duas pesagens", () => {
    const result = computeWeightGain([
      { date: new Date("2024-06-01"), weightKg: 180 },
      { date: new Date("2024-12-01"), weightKg: 300 },
    ]);

    expect(result).not.toBeNull();
    expect(result?.firstWeightKg).toBe(180);
    expect(result?.lastWeightKg).toBe(300);
    expect(result?.totalGainKg).toBe(120);
    expect(result?.days).toBe(183);
  });

  it("ordena as pesagens mesmo se vierem fora de ordem", () => {
    const result = computeWeightGain([
      { date: new Date("2024-12-01"), weightKg: 300 },
      { date: new Date("2024-06-01"), weightKg: 180 },
    ]);

    // mesmo passando a mais recente primeiro, deve pegar 180 como inicial
    expect(result?.firstWeightKg).toBe(180);
    expect(result?.lastWeightKg).toBe(300);
  });

  it("retorna null com menos de duas pesagens", () => {
    const result = computeWeightGain([
      { date: new Date("2024-06-01"), weightKg: 180 },
    ]);

    expect(result).toBeNull();
  });

  it("retorna null com nenhuma pesagem", () => {
    const result = computeWeightGain([]);
    expect(result).toBeNull();
  });

  it("aceita peso como texto (vindo do Prisma) e calcula certo", () => {
    const result = computeWeightGain([
      { date: new Date("2024-01-01"), weightKg: "200.00" },
      { date: new Date("2024-01-11"), weightKg: "250.00" },
    ]);

    expect(result?.totalGainKg).toBe(50);
    expect(result?.days).toBe(10);
    expect(result?.averageDailyGainKg).toBe(5); // 50kg / 10 dias
  });
});