import { describe, expect, it } from "vitest";
import { checkDeal, checkRows, splitApiErrors, startEdit } from "./tradeForm.js";
import type { DraftRow } from "./tradeMath.js";
import type { Trade } from "./trade.js";

const deal = {
  date: "2026-10-13",
  priceUnit: "PER_KG" as const,
  arrobaBasis: null,
  factor: "30",
  counterparty: "",
  notes: "",
};

const row = (key: string, category: DraftRow["animal"]["category"], liveWeight: string): DraftRow => ({
  key,
  animal: { id: key, tag: key, sex: category === "COW" ? "FEMALE" : "MALE", category, breed: null },
  liveWeight,
  carcassWeight: "",
  individualPrice: null,
  selectionPrice: null,
});

describe("checkDeal", () => {
  it("por kg não precisa de base nem fator", () => {
    expect(checkDeal(deal)).toEqual({
      pricing: { priceUnit: "PER_KG", arrobaBasis: null, arrobaFactorKg: null },
      errors: {},
    });
  });

  it("arroba exige a base; peso vivo exige fator válido", () => {
    expect(checkDeal({ ...deal, priceUnit: "PER_ARROBA" }).errors).toHaveProperty("arrobaBasis");
    expect(
      checkDeal({ ...deal, priceUnit: "PER_ARROBA", arrobaBasis: "LIVE_FACTOR", factor: "0" }).errors,
    ).toHaveProperty("arrobaFactorKg");
    expect(checkDeal({ ...deal, priceUnit: "PER_ARROBA", arrobaBasis: "LIVE_FACTOR", factor: "32,5" }).pricing).toEqual({
      priceUnit: "PER_ARROBA",
      arrobaBasis: "LIVE_FACTOR",
      arrobaFactorKg: "32.50",
    });
  });
});

describe("checkRows", () => {
  const pricing = { priceUnit: "PER_KG" as const, arrobaBasis: null, arrobaFactorKg: null };

  it("preço da categoria + peso → itens e total exato (o valor não vai para a API)", () => {
    const rows = [row("A", "COW", "333,33"), row("B", "BULL", "500")];
    const result = checkRows(rows, pricing, "category", { COW: "10,01", BULL: "12" });
    expect(result.ok).toBe(true);
    expect(result.items).toEqual([
      { liveWeightKg: "333.33", carcassWeightKg: null, unitPrice: "10.01", priceAdjusted: false },
      { liveWeightKg: "500.00", carcassWeightKg: null, unitPrice: "12.00", priceAdjusted: false },
    ]);
    expect(result.total).toBe("9336.63"); // 3336.63 + 6000.00
  });

  it("linha sem peso ou sem preço: não deixa salvar", () => {
    expect(checkRows([row("A", "COW", "")], pricing, "category", { COW: "10" }).ok).toBe(false);
    expect(checkRows([row("A", "COW", "300")], pricing, "category", {}).ok).toBe(false);
  });
});

describe("splitApiErrors", () => {
  it("erro de item vai para a linha certa; o resto vai para o campo", () => {
    const err = {
      status: 422,
      errors: [
        { field: "items.1.animalId", code: "ANIMAL_ALREADY_SOLD", params: { tag: "B", date: "2026-10-10" } },
        { field: "date", code: "REQUIRED" },
      ],
    };
    const split = splitApiErrors(err, ["A", "B"]);
    expect(split.rows).toEqual({ B: "B já foi vendido em 10/10/2026." });
    expect(Object.keys(split.deal)).toEqual(["date"]);
    expect(split.hasAny).toBe(true);
  });

  it("sem lista de erros: nada", () => {
    expect(splitApiErrors(new TypeError("Failed to fetch"), ["A"]).hasAny).toBe(false);
  });
});

describe("startEdit", () => {
  const animal = (id: string, breed: string | null) => ({
    id,
    tag: id,
    sex: "FEMALE" as const,
    category: "COW" as const,
    breed,
    status: "SOLD" as const,
  });
  const item = (id: string, breed: string | null, unitPrice: string, priceAdjusted = false) => ({
    id: `item-${id}`,
    animal: animal(id, breed),
    liveWeightKg: "400.00",
    carcassWeightKg: null,
    unitPrice,
    priceAdjusted,
    value: "0.00",
    hasWeighing: true,
  });
  const trade = (items: Trade["items"]): Trade => ({
    id: "t",
    type: "SALE",
    date: "2026-10-10",
    priceUnit: "PER_KG",
    arrobaBasis: null,
    arrobaFactorKg: null,
    currency: "BRL",
    counterparty: null,
    notes: null,
    animalCount: items.length,
    total: "0.00",
    knownTotal: "0.00",
    pending: false,
    items,
  });

  it("preço da categoria vem dos animais sem ajuste; o ajustado vira preço individual", () => {
    const start = startEdit(trade([item("A", null, "17.00"), item("B", null, "16.00", true)]), 30);
    expect(start.groupBy).toBe("category");
    expect(start.groupPrices).toEqual({ COW: "17,00" });
    expect(start.rows.map((r) => r.individualPrice)).toEqual([null, "16,00"]);
  });

  it("mesma categoria com preços diferentes sem ajuste = foi por categoria + raça", () => {
    const start = startEdit(trade([item("A", "Nelore", "17.00"), item("B", "Angus", "18.50")]), 30);
    expect(start.groupBy).toBe("categoryBreed");
    expect(start.rows.every((r) => r.individualPrice === null)).toBe(true);
  });
});
