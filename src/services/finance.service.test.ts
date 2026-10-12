import { describe, it, expect } from "vitest";
import { computeAnimalResult } from "./finance.service.js";

describe("computeAnimalResult", () => {
  it("apura resultado REAL quando o animal foi vendido", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: 200, pricePerKg: 10 }, // custo 2000
      sale: { weightKg: 450, pricePerKg: 12 }, // receita 5400
      currentWeightKg: 450,
      estimatedPricePerKg: 11,
    });

    expect(result.resultType).toBe("REALIZED");
    expect(result.purchaseCost).toBe(2000);
    expect(result.saleRevenue).toBe(5400);
    expect(result.estimatedValue).toBeNull(); // venda tem prioridade sobre estimativa
    expect(result.result).toBe(3400);
  });

  it("apura resultado ESTIMADO quando o animal está vivo e há preço informado", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: 200, pricePerKg: 10 }, // custo 2000
      sale: null,
      currentWeightKg: 380, // 380 × 11 = 4180
      estimatedPricePerKg: 11,
    });

    expect(result.resultType).toBe("ESTIMATED");
    expect(result.purchaseCost).toBe(2000);
    expect(result.saleRevenue).toBeNull();
    expect(result.estimatedValue).toBe(4180);
    expect(result.result).toBe(2180);
  });

  it("não apura resultado quando o animal está vivo e não há preço estimado", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: 200, pricePerKg: 10 },
      sale: null,
      currentWeightKg: 380,
      estimatedPricePerKg: null,
    });

    expect(result.resultType).toBeNull();
    expect(result.purchaseCost).toBe(2000); // o custo de compra ainda aparece
    expect(result.estimatedValue).toBeNull();
    expect(result.result).toBeNull();
  });

  it("não apura resultado estimado sem pesagem, mesmo com preço informado", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: 200, pricePerKg: 10 },
      sale: null,
      currentWeightKg: null,
      estimatedPricePerKg: 11,
    });

    expect(result.resultType).toBeNull();
    expect(result.result).toBeNull();
  });

  it("trata compra ausente como custo zero (animal nascido na fazenda) na venda", () => {
    const result = computeAnimalResult({
      purchase: null,
      sale: { weightKg: 450, pricePerKg: 12 }, // receita 5400
      currentWeightKg: 450,
      estimatedPricePerKg: null,
    });

    expect(result.resultType).toBe("REALIZED");
    expect(result.purchaseCost).toBeNull(); // fica explícito que não foi informada
    expect(result.saleRevenue).toBe(5400);
    expect(result.result).toBe(5400); // receita − 0
  });

  it("trata compra ausente como custo zero na estimativa", () => {
    const result = computeAnimalResult({
      purchase: null,
      sale: null,
      currentWeightKg: 300,
      estimatedPricePerKg: 11, // 3300
    });

    expect(result.resultType).toBe("ESTIMATED");
    expect(result.purchaseCost).toBeNull();
    expect(result.estimatedValue).toBe(3300);
    expect(result.result).toBe(3300);
  });

  it("aceita peso e preço como texto (vindos do Prisma) e arredonda dinheiro", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: "201.50", pricePerKg: "10.30" }, // 2075.45
      sale: { weightKg: "452.70", pricePerKg: "12.15" }, // 5500.305 → 5500.31
      currentWeightKg: "452.70",
      estimatedPricePerKg: null,
    });

    expect(result.purchaseCost).toBe(2075.45);
    expect(result.saleRevenue).toBe(5500.31);
    expect(result.result).toBe(3424.86); // 5500.31 − 2075.45
  });

  it("retorna prejuízo (resultado negativo) quando a receita é menor que o custo", () => {
    const result = computeAnimalResult({
      purchase: { weightKg: 400, pricePerKg: 14 }, // custo 5600
      sale: { weightKg: 420, pricePerKg: 12 }, // receita 5040
      currentWeightKg: 420,
      estimatedPricePerKg: null,
    });

    expect(result.result).toBe(-560);
  });
});
