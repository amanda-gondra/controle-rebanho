import { describe, expect, it } from "vitest";
import { describeEvent, originText } from "./history.js";
import type { AnimalEvent } from "./animal.js";

const labels = { category: (c: string) => `cat:${c}`, sex: (s: string) => `sex:${s}` };
const event = (partial: Partial<AnimalEvent>): AnimalEvent => ({
  id: "e1",
  animalId: "a1",
  type: "TAG_CHANGED",
  fromValue: null,
  toValue: null,
  reason: null,
  effectiveDate: "2026-10-10",
  userName: null,
  createdAt: "2026-10-10T12:00:00.000Z",
  ...partial,
});

describe("describeEvent (linha do tempo)", () => {
  it("troca de brinco mostra de, para e motivo", () => {
    expect(describeEvent(event({ fromValue: "BR-104", toValue: "BR-210", reason: "LOST" }), labels)).toBe(
      "Brinco: BR-104 → BR-210 (Brinco perdido)",
    );
  });

  it("categoria usa os nomes da fazenda", () => {
    expect(describeEvent(event({ type: "CATEGORY_CHANGED", fromValue: "CALF", toValue: "YEARLING" }), labels)).toBe(
      "Categoria: cat:CALF → cat:YEARLING",
    );
  });

  it("morte com causa e certeza; correção e volta para ativo", () => {
    const dead = JSON.stringify({ status: "DEAD", exitDate: "2026-10-10", certainty: "SUSPECTED", cause: "picada" });
    expect(describeEvent(event({ type: "STATUS_CHANGED", fromValue: JSON.stringify({ status: "ACTIVE" }), toValue: dead }), labels)).toBe(
      "Morte em 10/10/2026 (causa suspeita): picada",
    );
    expect(describeEvent(event({ type: "STATUS_CHANGED", fromValue: dead, toValue: JSON.stringify({ status: "ACTIVE" }) }), labels)).toBe(
      "Voltou para ativo (saída desfeita)",
    );
    const sold = (date: string) => JSON.stringify({ status: "SOLD", exitDate: date });
    expect(describeEvent(event({ type: "STATUS_CHANGED", fromValue: sold("2026-05-10"), toValue: sold("2026-05-11") }), labels)).toBe(
      "Data da venda corrigida para 11/05/2026",
    );
  });

  it("nascimento e origem", () => {
    expect(
      describeEvent(
        event({
          type: "BIRTH_CHANGED",
          fromValue: JSON.stringify({ precision: "UNKNOWN" }),
          toValue: JSON.stringify({ precision: "DAY_MONTH_YEAR", date: "2026-02-10" }),
        }),
        labels,
      ),
    ).toBe("Nascimento: não informado → 10/02/2026");
    expect(originText("PURCHASED", "2026-01-15")).toBe("Comprado, entrada em 15/01/2026");
    expect(originText("NOT_INFORMED")).toBe("Origem não informada");
  });

  it("valor estranho não quebra a tela", () => {
    expect(describeEvent(event({ type: "STATUS_CHANGED", fromValue: "{", toValue: "lixo" }), labels)).toBe("Situação alterada");
  });
});
