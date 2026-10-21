import { describe, expect, it } from "vitest";
import { planLotMove } from "./lot.service.js";

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
