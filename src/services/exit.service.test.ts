import { describe, expect, it } from "vitest";
import { checkDateWithinLife, findExitConflict } from "./exit.service.js";

describe("findExitConflict (RN-ANIMAL-011)", () => {
  it("sem registros depois da data, a saída serve", () => {
    expect(findExitConflict("2026-10-10", {})).toBeNull();
    expect(
      findExitConflict("2026-10-10", {
        birthDate: "2024-01-01",
        purchaseDate: "2025-01-01",
        lastWeighingDate: "2026-10-10", // no mesmo dia pode
        lastApplicationDate: "2026-09-01",
      }),
    ).toBeNull();
  });

  it("pesagem depois da data impede, e diz qual", () => {
    expect(findExitConflict("2026-10-10", { lastWeighingDate: "2026-10-12" })).toEqual({
      kind: "WEIGHING",
      date: "2026-10-12",
    });
  });

  it("com vários impedimentos, aponta o mais recente", () => {
    expect(
      findExitConflict("2026-01-01", {
        birthDate: "2026-02-01",
        purchaseDate: "2026-03-01",
        lastWeighingDate: "2026-05-01",
        lastApplicationDate: "2026-04-01",
      }),
    ).toEqual({ kind: "WEIGHING", date: "2026-05-01" });
  });

  it.each([
    ["BIRTH", { birthDate: "2026-11-01" }],
    ["PURCHASE", { purchaseDate: "2026-11-01" }],
    ["APPLICATION", { lastApplicationDate: "2026-11-01" }],
  ] as const)("%s depois da saída impede", (kind, facts) => {
    expect(findExitConflict("2026-10-10", facts)?.kind).toBe(kind);
  });
});

describe("checkDateWithinLife (RN-ANIMAL-012 / RN-PES-004)", () => {
  it("depois da saída não pode; no dia da saída pode", () => {
    expect(checkDateWithinLife("2026-10-11", { exitDate: "2026-10-10" })).toEqual({
      reason: "AFTER_EXIT",
      date: "2026-10-10",
    });
    expect(checkDateWithinLife("2026-10-10", { exitDate: "2026-10-10" })).toBeNull();
  });

  it("antes do nascimento só barra quando o nascimento tem dia certo", () => {
    expect(
      checkDateWithinLife("2026-01-01", { birthDate: "2026-02-10", birthIsExact: true }),
    ).toEqual({ reason: "BEFORE_BIRTH", date: "2026-02-10" });
    expect(checkDateWithinLife("2026-01-01", { birthDate: "2026-02-01", birthIsExact: false })).toBeNull();
  });

  it("animal ativo sem nascimento: qualquer data serve", () => {
    expect(checkDateWithinLife("2020-01-01", {})).toBeNull();
  });
});
