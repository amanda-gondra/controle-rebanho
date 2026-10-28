import { describe, expect, it } from "vitest";
import {
  checkAnimalForTrade,
  computeItemValue,
  findItemProblem,
  sumValues,
  summarizeTrades,
  type AnimalTradeFacts,
} from "./trade.service.js";

const perKg = { priceUnit: "PER_KG" } as const;
const carcass = { priceUnit: "PER_ARROBA", arrobaBasis: "CARCASS" } as const;
const liveFactor = (factor: number | string) =>
  ({ priceUnit: "PER_ARROBA", arrobaBasis: "LIVE_FACTOR", arrobaFactorKg: factor }) as const;
const perHead = { priceUnit: "PER_HEAD" } as const;

describe("computeItemValue (RN-NEG-001)", () => {
  it("por kg = peso vivo × preço", () => {
    expect(computeItemValue(perKg, { liveWeightKg: 450, unitPrice: 11 })).toBe("4950.00");
  });

  it("arroba de carcaça = (carcaça ÷ 15) × preço — critério 5", () => {
    expect(computeItemValue(carcass, { liveWeightKg: 480, carcassWeightKg: 240, unitPrice: 300 })).toBe("4800.00");
  });

  it("arroba de carcaça sem o peso de carcaça fica pendente (D-35)", () => {
    expect(computeItemValue(carcass, { liveWeightKg: 480, carcassWeightKg: null, unitPrice: 300 })).toBeNull();
  });

  it("arroba de peso vivo = (peso ÷ fator) × preço — critério 4", () => {
    expect(computeItemValue(liveFactor(30), { liveWeightKg: 450, unitPrice: 300 })).toBe("4500.00");
    // fator diferente de 30
    expect(computeItemValue(liveFactor(32), { liveWeightKg: 450, unitPrice: 300 })).toBe("4218.75");
    expect(computeItemValue(liveFactor("30.50"), { liveWeightKg: 450, unitPrice: 300 })).toBe("4426.23");
  });

  it("por cabeça = preço, com ou sem peso — critério 6", () => {
    expect(computeItemValue(perHead, { unitPrice: 3000 })).toBe("3000.00");
    expect(computeItemValue(perHead, { liveWeightKg: 400, unitPrice: "3000.50" })).toBe("3000.50");
  });

  it("centavos: arredonda por item, meio para cima — critério 16", () => {
    // 333,33 × 10,01 = 3336,6333 → 3336,63
    expect(computeItemValue(perKg, { liveWeightKg: 333.33, unitPrice: 10.01 })).toBe("3336.63");
    // 0,05 × 0,05 = 0,0025 → 0,00 ; 0,15 × 0,05 = 0,0075 → 0,01
    expect(computeItemValue(perKg, { liveWeightKg: 0.05, unitPrice: 0.05 })).toBe("0.00");
    expect(computeItemValue(perKg, { liveWeightKg: 0.15, unitPrice: 0.05 })).toBe("0.01");
    // exatamente meio centavo: 0,5 × 0,01 = 0,005 → 0,01
    expect(computeItemValue(perKg, { liveWeightKg: 0.5, unitPrice: 0.01 })).toBe("0.01");
    // 1 kg de carcaça a R$ 1/@ = 0,0666… → 0,07
    expect(computeItemValue(carcass, { liveWeightKg: 1, carcassWeightKg: 1, unitPrice: 1 })).toBe("0.07");
  });

  it("valores-limite não perdem precisão (sem ponto flutuante)", () => {
    expect(computeItemValue(perKg, { liveWeightKg: "9999.99", unitPrice: "99999999.99" })).toBe(
      "999998999900.00",
    );
    expect(computeItemValue(perHead, { unitPrice: "99999999.99" })).toBe("99999999.99");
    expect(computeItemValue(perKg, { liveWeightKg: 0.01, unitPrice: 0.01 })).toBe("0.00");
  });

  it("aceita os decimais que vêm do banco como texto", () => {
    expect(computeItemValue(perKg, { liveWeightKg: "450.5", unitPrice: "10.2" })).toBe("4595.10");
  });

  it("forma de preço incompleta é erro de programação, não valor", () => {
    expect(() => computeItemValue(perKg, { unitPrice: 10 })).toThrow();
    expect(() => computeItemValue({ priceUnit: "PER_ARROBA" }, { liveWeightKg: 1, unitPrice: 1 })).toThrow();
  });
});

describe("sumValues", () => {
  it("total = soma exata dos itens já arredondados", () => {
    const values = [
      computeItemValue(perKg, { liveWeightKg: 333.33, unitPrice: 10.01 }),
      computeItemValue(perKg, { liveWeightKg: 333.33, unitPrice: 10.01 }),
      computeItemValue(perKg, { liveWeightKg: 333.33, unitPrice: 10.01 }),
    ];
    // 3 × 3336,63 (e não 999,99 × 10,01 = 10009,8999)
    expect(sumValues(values)).toBe("10009.89");
  });

  it("com item pendente, o total fica pendente", () => {
    expect(sumValues(["10.00", null])).toBeNull();
    expect(sumValues([])).toBe("0.00");
  });
});

describe("findItemProblem", () => {
  it("peso vivo obrigatório, exceto por cabeça", () => {
    expect(findItemProblem(perKg, { unitPrice: 1 })).toBe("LIVE_WEIGHT_REQUIRED");
    expect(findItemProblem(liveFactor(30), { unitPrice: 1 })).toBe("LIVE_WEIGHT_REQUIRED");
    expect(findItemProblem(carcass, { carcassWeightKg: 200, unitPrice: 1 })).toBe("LIVE_WEIGHT_REQUIRED");
    expect(findItemProblem(perHead, { unitPrice: 1 })).toBeNull();
  });

  it("carcaça só na arroba por carcaça e nunca acima do peso vivo", () => {
    expect(findItemProblem(perKg, { liveWeightKg: 400, carcassWeightKg: 200, unitPrice: 1 })).toBe(
      "CARCASS_WEIGHT_NOT_ALLOWED",
    );
    expect(findItemProblem(carcass, { liveWeightKg: 400, carcassWeightKg: 400.01, unitPrice: 1 })).toBe(
      "CARCASS_ABOVE_LIVE_WEIGHT",
    );
    expect(findItemProblem(carcass, { liveWeightKg: 400, carcassWeightKg: 400, unitPrice: 1 })).toBeNull();
    expect(findItemProblem(carcass, { liveWeightKg: 400, unitPrice: 1 })).toBeNull();
  });
});


const facts = (overrides: Partial<AnimalTradeFacts> = {}): AnimalTradeFacts => ({
  status: "ACTIVE",
  exitDate: null,
  birthDate: null,
  birthIsExact: false,
  purchaseDate: null,
  saleDate: null,
  lastWeighingDate: null,
  lastApplicationDate: null,
  ...overrides,
});

describe("checkAnimalForTrade (RN-NEG-004/005/007)", () => {
  it("venda: morto nunca, já vendido nunca", () => {
    expect(checkAnimalForTrade("SALE", "2026-10-01", facts({ status: "DEAD" }))).toEqual({
      code: "DEAD_ANIMAL_CANNOT_BE_SOLD",
    });
    expect(checkAnimalForTrade("SALE", "2026-10-01", facts({ saleDate: "2026-09-01" }))).toEqual({
      code: "ANIMAL_ALREADY_SOLD",
      date: "2026-09-01",
    });
  });

  it("venda: não antes da compra; no mesmo dia pode", () => {
    expect(checkAnimalForTrade("SALE", "2026-01-01", facts({ purchaseDate: "2026-01-02" }))?.code).toBe(
      "SALE_BEFORE_PURCHASE",
    );
    expect(checkAnimalForTrade("SALE", "2026-01-02", facts({ purchaseDate: "2026-01-02" }))).toBeNull();
  });

  it("venda: nada registrado depois dela", () => {
    expect(checkAnimalForTrade("SALE", "2026-10-01", facts({ lastWeighingDate: "2026-10-02" }))).toEqual({
      code: "EXIT_DATE_CONFLICT",
      kind: "WEIGHING",
      date: "2026-10-02",
    });
    expect(checkAnimalForTrade("SALE", "2026-10-01", facts({ lastWeighingDate: "2026-10-01" }))).toBeNull();
  });

  it("venda de animal 'vendido' na mão (sem venda registrada) é aceita", () => {
    expect(checkAnimalForTrade("SALE", "2026-10-01", facts({ status: "SOLD", exitDate: "2026-09-01" }))).toBeNull();
  });

  it("compra: uma só; não depois da venda; dentro da vida do animal", () => {
    expect(checkAnimalForTrade("PURCHASE", "2026-01-01", facts({ purchaseDate: "2025-12-01" }))?.code).toBe(
      "ANIMAL_ALREADY_PURCHASED",
    );
    expect(checkAnimalForTrade("PURCHASE", "2026-03-02", facts({ saleDate: "2026-03-01" }))?.code).toBe(
      "SALE_BEFORE_PURCHASE",
    );
    expect(
      checkAnimalForTrade("PURCHASE", "2026-05-02", facts({ status: "DEAD", exitDate: "2026-05-01" })),
    ).toEqual({ code: "TRADE_DATE_OUT_OF_RANGE", reason: "AFTER_EXIT", date: "2026-05-01" });
    expect(
      checkAnimalForTrade("PURCHASE", "2026-04-09", facts({ birthDate: "2026-04-10", birthIsExact: true })),
    ).toEqual({ code: "TRADE_DATE_OUT_OF_RANGE", reason: "BEFORE_BIRTH", date: "2026-04-10" });
    // compra antes de uma pesagem já registrada é normal (animal pesado e depois comprado de um sócio)
    expect(checkAnimalForTrade("PURCHASE", "2026-01-01", facts({ lastWeighingDate: "2026-02-01" }))).toBeNull();
  });
});

describe("summarizeTrades (tela Negociações)", () => {
  it("conta compras e vendas, animais e soma exata do que tem valor", () => {
    const summary = summarizeTrades(
      [
        { type: "SALE", currency: "BRL", values: ["1000.10", "999.95"] },
        { type: "SALE", currency: "BRL", values: ["0.05", null] }, // pendente: soma só o conhecido
        { type: "PURCHASE", currency: "BRL", values: ["2500.00"] },
      ],
      "BRL",
    );
    expect(summary).toEqual({
      count: 3,
      pending: 1,
      otherCurrency: 0,
      sales: { count: 2, animals: 4, total: "2000.10" },
      purchases: { count: 1, animals: 1, total: "2500.00" },
    });
  });

  it("outra moeda não se mistura na soma", () => {
    const summary = summarizeTrades([{ type: "PURCHASE", currency: "USD", values: ["10.00"] }], "BRL");
    expect(summary.purchases).toEqual({ count: 1, animals: 1, total: "0.00" });
    expect(summary.otherCurrency).toBe(1);
  });

  it("sem negociações: tudo zero", () => {
    expect(summarizeTrades([], "BRL")).toMatchObject({ count: 0, sales: { total: "0.00" }, purchases: { total: "0.00" } });
  });
});
