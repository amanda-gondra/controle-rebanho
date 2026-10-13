import { describe, expect, it } from "vitest";
import { BRAZIL_TIME_ZONES, FARM_DEFAULTS } from "./farm.js";
import { todayInTimeZone } from "./dates.js";

describe("fusos do Brasil (D-31)", () => {
  it("todos existem no banco de fusos do sistema (Intl)", () => {
    const known = new Set(Intl.supportedValuesOf("timeZone"));
    for (const zone of BRAZIL_TIME_ZONES) {
      expect(known.has(zone), zone).toBe(true);
      expect(() => todayInTimeZone(zone), zone).not.toThrow();
    }
  });

  it("o fuso padrão está na lista", () => {
    expect(BRAZIL_TIME_ZONES).toContain(FARM_DEFAULTS.timezone);
  });

  it("não tem repetidos", () => {
    expect(new Set(BRAZIL_TIME_ZONES).size).toBe(BRAZIL_TIME_ZONES.length);
  });
});
