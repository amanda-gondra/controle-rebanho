import { describe, it, expect } from "vitest";
import { addDays, isNotInFuture, toDbDate, todayInTimeZone } from "./dates.js";

describe("datas de calendário no fuso da fazenda", () => {
  it("às 22h de 11/10 em Brasília, hoje ainda é 11/10 (em UTC já é 12/10)", () => {
    const now = new Date("2026-10-11T22:00:00-03:00");
    expect(todayInTimeZone("America/Sao_Paulo", now)).toBe("2026-10-11");
  });

  it("recusa a data de amanhã mesmo à noite (F-04)", () => {
    const now = new Date("2026-10-11T22:00:00-03:00");
    expect(isNotInFuture("2026-10-12", "America/Sao_Paulo", now)).toBe(false);
    expect(isNotInFuture("2026-10-11", "America/Sao_Paulo", now)).toBe(true);
  });

  it("aceita a data de hoje logo depois da meia-noite", () => {
    const now = new Date("2026-10-12T00:05:00-03:00");
    expect(isNotInFuture("2026-10-12", "America/Sao_Paulo", now)).toBe(true);
  });

  it("respeita outro fuso quando informado", () => {
    const now = new Date("2026-10-12T02:00:00Z");
    expect(todayInTimeZone("Asia/Tokyo", now)).toBe("2026-10-12");
    expect(todayInTimeZone("America/New_York", now)).toBe("2026-10-11");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("grava a data de calendário como meia-noite UTC", () => {
    expect(toDbDate("2026-10-12").toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
});
