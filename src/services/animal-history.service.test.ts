import { describe, expect, it } from "vitest";
import { birthValue, checkEntryDate, diffAnimal, originValue, statusValue, type AnimalSnapshot } from "./animal-history.service.js";

const base: AnimalSnapshot = {
  tag: "BR-104",
  sex: "MALE",
  category: "CALF",
  birthPrecision: "UNKNOWN",
  birthDate: null,
  status: "ACTIVE",
  exitDate: null,
  deathCause: null,
  deathCauseCertainty: null,
  origin: "NOT_INFORMED",
  entryDate: null,
};

describe("diffAnimal", () => {
  it("nada mudou → nenhum evento", () => {
    expect(diffAnimal(base, { ...base })).toEqual([]);
  });

  it("categoria e sexo viram eventos com antes e depois", () => {
    const changes = diffAnimal(base, { ...base, sex: "FEMALE", category: "HEIFER" });
    expect(changes).toEqual([
      { type: "SEX_CHANGED", fromValue: "MALE", toValue: "FEMALE" },
      { type: "CATEGORY_CHANGED", fromValue: "CALF", toValue: "HEIFER" },
    ]);
  });

  it("nascimento guarda precisão e data", () => {
    const [change] = diffAnimal(base, { ...base, birthPrecision: "MONTH_YEAR", birthDate: "2026-03-01" });
    expect(change.type).toBe("BIRTH_CHANGED");
    expect(JSON.parse(change.fromValue!)).toEqual({ precision: "UNKNOWN" });
    expect(JSON.parse(change.toValue!)).toEqual({ precision: "MONTH_YEAR", date: "2026-03-01" });
  });

  it("morte guarda data, certeza e causa; reversão volta para ativo", () => {
    const dead = { ...base, status: "DEAD", exitDate: "2026-10-10", deathCause: "picada", deathCauseCertainty: "SUSPECTED" };
    const [change] = diffAnimal(base, dead);
    expect(JSON.parse(change.toValue!)).toEqual({ status: "DEAD", exitDate: "2026-10-10", certainty: "SUSPECTED", cause: "picada" });
    const [revert] = diffAnimal(dead, base);
    expect(JSON.parse(revert.toValue!)).toEqual({ status: "ACTIVE" });
  });

  it("corrigir só a data da saída também é registrado", () => {
    const sold = { ...base, status: "SOLD", exitDate: "2026-10-10" };
    const [change] = diffAnimal(sold, { ...sold, exitDate: "2026-10-09" });
    expect(change.type).toBe("STATUS_CHANGED");
  });

  it("origem e entrada", () => {
    const [change] = diffAnimal(base, { ...base, origin: "PURCHASED", entryDate: "2026-01-10" });
    expect(change).toEqual({
      type: "ORIGIN_CHANGED",
      fromValue: originValue("NOT_INFORMED", null),
      toValue: originValue("PURCHASED", "2026-01-10"),
    });
  });

  it("valores são estáveis (o mesmo dado → o mesmo texto)", () => {
    expect(birthValue("DAY_MONTH_YEAR", null)).toBe(birthValue("UNKNOWN", null));
    expect(statusValue({ status: "SOLD", exitDate: "2026-01-01", deathCause: "x", deathCauseCertainty: "CONFIRMED" })).toBe(
      JSON.stringify({ status: "SOLD", exitDate: "2026-01-01" }),
    );
  });
});

describe("checkEntryDate", () => {
  const life = { birthDate: "2026-02-10", birthPrecision: "DAY_MONTH_YEAR", exitDate: "2026-09-01" };
  it("aceita vazio e datas dentro da vida", () => {
    expect(checkEntryDate(null, life)).toBeNull();
    expect(checkEntryDate("2026-02-10", life)).toBeNull();
    expect(checkEntryDate("2026-09-01", life)).toBeNull();
  });
  it("recusa antes do nascimento com dia certo e depois da saída", () => {
    expect(checkEntryDate("2026-02-09", life)).toEqual({ reason: "BEFORE_BIRTH", date: "2026-02-10" });
    expect(checkEntryDate("2026-09-02", life)).toEqual({ reason: "AFTER_EXIT", date: "2026-09-01" });
  });
  it("nascimento só com mês e ano não limita a entrada", () => {
    expect(checkEntryDate("2026-01-01", { ...life, birthPrecision: "MONTH_YEAR" })).toBeNull();
  });
});
