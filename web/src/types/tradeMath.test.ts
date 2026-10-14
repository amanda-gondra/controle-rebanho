import { describe, expect, it } from "vitest";
import { computeItemValue } from "../../../src/services/trade.service.js";
import { effectivePrice, evaluateRow, groupKeyOf, itemValue, parseDecimalInput, sumValues } from "./tradeMath.js";

describe("itemValue — mesma conta do servidor", () => {
  const pricings = [
    { priceUnit: "PER_KG", arrobaBasis: null, arrobaFactorKg: null },
    { priceUnit: "PER_HEAD", arrobaBasis: null, arrobaFactorKg: null },
    { priceUnit: "PER_ARROBA", arrobaBasis: "CARCASS", arrobaFactorKg: null },
    { priceUnit: "PER_ARROBA", arrobaBasis: "LIVE_FACTOR", arrobaFactorKg: "30.00" },
    { priceUnit: "PER_ARROBA", arrobaBasis: "LIVE_FACTOR", arrobaFactorKg: "32.50" },
  ] as const;
  const weights = ["0.01", "0.15", "1.00", "240.00", "333.33", "450.50", "9999.99"];
  const prices = ["0.01", "0.05", "9.50", "10.01", "300.00", "99999999.99"];

  it("dá o mesmo resultado em todas as combinações", () => {
    for (const pricing of pricings) {
      for (const weight of weights) {
        for (const price of prices) {
          const item = { liveWeightKg: weight, carcassWeightKg: weight, unitPrice: price };
          const server = computeItemValue(
            pricing,
            pricing.arrobaBasis === "CARCASS" ? item : { ...item, carcassWeightKg: null },
          );
          expect(itemValue(pricing, item), `${pricing.priceUnit}/${pricing.arrobaBasis} ${weight} × ${price}`).toBe(
            server,
          );
        }
      }
    }
  });

  it("sem peso ou sem preço: ainda não dá para calcular", () => {
    expect(itemValue(pricings[0], { liveWeightKg: null, carcassWeightKg: null, unitPrice: "10.00" })).toBeNull();
    expect(itemValue(pricings[0], { liveWeightKg: "400.00", carcassWeightKg: null, unitPrice: null })).toBeNull();
    expect(itemValue(pricings[2], { liveWeightKg: "400.00", carcassWeightKg: null, unitPrice: "300.00" })).toBeNull();
  });

  it("soma exata", () => {
    expect(sumValues(["3336.63", "3336.63", "3336.63"])).toBe("10009.89");
    expect(sumValues(["10.00", null])).toBe("10.00");
  });
});

describe("parseDecimalInput", () => {
  it("aceita vírgula ou ponto, e milhar com ponto quando há vírgula", () => {
    expect(parseDecimalInput("12,5")).toBe("12.50");
    expect(parseDecimalInput("1.234,56")).toBe("1234.56");
    expect(parseDecimalInput("1234.56")).toBe("1234.56");
    expect(parseDecimalInput(" 450 ")).toBe("450.00");
  });

  it("vazio é null; texto ou mais de 2 casas é inválido", () => {
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("abc")).toBeUndefined();
    expect(parseDecimalInput("1,234")).toBeUndefined();
    expect(parseDecimalInput("-5")).toBeUndefined();
  });
});

describe("grupos e preço (RN-NEG-018/021/022)", () => {
  it("bezerro e bezerra em grupos separados; raça junta maiúsculas", () => {
    expect(groupKeyOf({ category: "CALF", sex: "MALE", breed: null }, "category")).toBe("CALF_MALE");
    expect(groupKeyOf({ category: "CALF", sex: "FEMALE", breed: null }, "category")).toBe("CALF_FEMALE");
    expect(groupKeyOf({ category: "COW", sex: "FEMALE", breed: " Nelore" }, "categoryBreed")).toBe(
      groupKeyOf({ category: "COW", sex: "FEMALE", breed: "nelore" }, "categoryBreed"),
    );
  });

  it("individual > selecionados > categoria", () => {
    expect(effectivePrice({ individualPrice: null, selectionPrice: null }, "17.00")).toEqual({
      price: "17.00",
      adjusted: false,
    });
    expect(effectivePrice({ individualPrice: null, selectionPrice: "16.00" }, "17.00")).toEqual({
      price: "16.00",
      adjusted: true,
    });
    expect(effectivePrice({ individualPrice: "18.00", selectionPrice: "16.00" }, "17.00")).toEqual({
      price: "18.00",
      adjusted: true,
    });
    // igual ao da categoria não conta como ajuste
    expect(effectivePrice({ individualPrice: "17.00", selectionPrice: null }, "17.00").adjusted).toBe(false);
  });
});

describe("evaluateRow", () => {
  const animal = { id: "a", tag: "A-1", sex: "FEMALE" as const, category: "COW" as const, breed: null };
  const row = (overrides = {}) => ({
    key: "a",
    animal,
    liveWeight: "450",
    carcassWeight: "",
    individualPrice: null,
    selectionPrice: null,
    ...overrides,
  });
  const perKg = { priceUnit: "PER_KG", arrobaBasis: null, arrobaFactorKg: null } as const;
  const carcass = { priceUnit: "PER_ARROBA", arrobaBasis: "CARCASS", arrobaFactorKg: null } as const;

  it("peso e preço da categoria → valor", () => {
    expect(evaluateRow(row(), perKg, "17,00")).toMatchObject({ value: "7650.00", adjusted: false, problems: {} });
  });

  it("aponta o que falta ou está errado", () => {
    expect(evaluateRow(row({ liveWeight: "" }), perKg, "17").problems).toEqual({ liveWeight: "REQUIRED" });
    expect(evaluateRow(row({ liveWeight: "4x" }), perKg, "17").problems).toEqual({ liveWeight: "INVALID" });
    expect(evaluateRow(row(), perKg, "").problems).toEqual({ price: "REQUIRED" });
    expect(evaluateRow(row({ carcassWeight: "460" }), carcass, "300").problems).toEqual({
      carcassWeight: "CARCASS_ABOVE_LIVE_WEIGHT",
    });
  });

  it("carcaça em branco pode: fica aguardando romaneio", () => {
    expect(evaluateRow(row(), carcass, "300")).toMatchObject({ awaitingCarcass: true, value: null, problems: {} });
  });

  it("por cabeça não exige peso", () => {
    const perHead = { priceUnit: "PER_HEAD", arrobaBasis: null, arrobaFactorKg: null } as const;
    expect(evaluateRow(row({ liveWeight: "" }), perHead, "3000")).toMatchObject({ value: "3000.00", problems: {} });
  });
});
