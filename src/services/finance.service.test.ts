import { describe, expect, it } from "vitest";
import { computeAnimalResult, type TradeSide } from "./finance.service.js";

const side = (value: string | null, currency = "BRL"): TradeSide => ({
  tradeId: "t",
  itemId: "i",
  date: "2026-10-01",
  priceUnit: "PER_KG",
  arrobaBasis: null,
  liveWeightKg: "450.00",
  carcassWeightKg: null,
  unitPrice: "10.00",
  value,
  currency,
});

describe("computeAnimalResult (RN-NEG-012)", () => {
  it("compra e venda: diferença venda − compra — critério 15", () => {
    const result = computeAnimalResult(side("2500.00"), side("3600.00"));
    expect(result.kind).toBe("DIFFERENCE");
    expect(result.difference).toBe("1100.00");
  });

  it("diferença negativa quando vendeu por menos", () => {
    expect(computeAnimalResult(side("3000.00"), side("2850.50")).difference).toBe("-149.50");
  });

  it("centavos exatos (sem ponto flutuante)", () => {
    expect(computeAnimalResult(side("0.10"), side("0.30")).difference).toBe("0.20");
  });

  it("só compra: investido; só venda: mostra a venda", () => {
    expect(computeAnimalResult(side("2500.00"), null)).toMatchObject({ kind: "INVESTED", difference: null });
    expect(computeAnimalResult(null, side("3600.00"))).toMatchObject({ kind: "SALE_ONLY", difference: null });
  });

  it("valor pendente (romaneio) não calcula", () => {
    expect(computeAnimalResult(side("2500.00"), side(null)).kind).toBe("PENDING");
    expect(computeAnimalResult(null, side(null)).kind).toBe("PENDING");
  });

  it("moedas diferentes: não calcula e avisa", () => {
    expect(computeAnimalResult(side("2500.00", "BRL"), side("900.00", "USD"))).toMatchObject({
      kind: "CURRENCY_MISMATCH",
      difference: null,
    });
  });

  it("sem compra nem venda: nada", () => {
    expect(computeAnimalResult(null, null).kind).toBeNull();
  });
});
