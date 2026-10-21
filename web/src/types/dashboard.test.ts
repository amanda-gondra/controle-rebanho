import { describe, expect, it } from "vitest";
import { presetOf, presetPeriod } from "./dashboard.js";

describe("presetPeriod — atalhos do painel", () => {
  it("este mês, mês passado, 30 dias e este ano", () => {
    expect(presetPeriod("thisMonth", "2026-03-15")).toEqual({ from: "2026-03-01", to: "2026-03-15" });
    expect(presetPeriod("lastMonth", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetPeriod("lastMonth", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetPeriod("last30", "2026-03-15")).toEqual({ from: "2026-02-14", to: "2026-03-15" });
    expect(presetPeriod("thisYear", "2026-03-15")).toEqual({ from: "2026-01-01", to: "2026-03-15" });
  });

  it("reconhece o atalho de um período", () => {
    expect(presetOf({ from: "2026-03-01", to: "2026-03-15" }, "2026-03-15")).toBe("thisMonth");
    expect(presetOf({ from: "2026-03-02", to: "2026-03-15" }, "2026-03-15")).toBeNull();
  });
});
