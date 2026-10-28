import { describe, it, expect } from "vitest";
import { classifyReapplication, findWithdrawalConflicts, isReminderOpen, withdrawalEndDate } from "./sanitary.service.js";

describe("classifyReapplication", () => {
  // um "hoje" fixo pra todos os testes, pra não depender da data real
  const hoje = new Date("2026-08-29T12:00:00");

  it("não é alerta quando não há data de reaplicação", () => {
    const result = classifyReapplication({ reapplyDate: null }, hoje);
    expect(result.isAlert).toBe(false);
    expect(result.overdue).toBe(false);
  });

  it("é alerta e NÃO está vencida quando a reaplicação é daqui a 3 dias", () => {
    const daquiA3Dias = new Date("2026-09-01T12:00:00");
    const result = classifyReapplication({ reapplyDate: daquiA3Dias }, hoje);
    expect(result.isAlert).toBe(true);
    expect(result.overdue).toBe(false);
  });

  it("é alerta e está vencida quando a reaplicação foi ontem", () => {
    const ontem = new Date("2026-08-28T12:00:00");
    const result = classifyReapplication({ reapplyDate: ontem }, hoje);
    expect(result.isAlert).toBe(true);
    expect(result.overdue).toBe(true);
  });

  it("NÃO é alerta quando a reaplicação é daqui a 10 dias (fora da janela de 7)", () => {
    const daquiA10Dias = new Date("2026-09-08T12:00:00");
    const result = classifyReapplication({ reapplyDate: daquiA10Dias }, hoje);
    expect(result.isAlert).toBe(false);
  });

  it("é alerta no limite exato da janela (exatamente 7 dias)", () => {
    const daquiA7Dias = new Date("2026-09-05T12:00:00");
    const result = classifyReapplication({ reapplyDate: daquiA7Dias }, hoje);
    expect(result.isAlert).toBe(true);
    expect(result.overdue).toBe(false);
  });

  // F-04: "hoje" é o dia no fuso da fazenda (Brasília), não o dia em UTC
  it("às 21h da véspera (Brasília), a reaplicação de amanhã NÃO está vencida", () => {
    const noite = new Date("2026-08-29T21:00:00-03:00"); // já é 30/08 em UTC
    const amanha = new Date("2026-08-30T00:00:00.000Z"); // como o banco guarda
    const result = classifyReapplication({ reapplyDate: amanha }, noite);
    expect(result.isAlert).toBe(true);
    expect(result.overdue).toBe(false);
  });

  it("a reaplicação de hoje não está vencida o dia todo, até 23h59 em Brasília", () => {
    const quaseMeiaNoite = new Date("2026-08-30T23:59:00-03:00");
    const hojeNoBanco = new Date("2026-08-30T00:00:00.000Z");
    const result = classifyReapplication({ reapplyDate: hojeNoBanco }, quaseMeiaNoite);
    expect(result.overdue).toBe(false);
  });

  it("vira vencida à 0h do dia seguinte em Brasília", () => {
    const meiaNoite = new Date("2026-08-31T00:00:00-03:00");
    const ontemNoBanco = new Date("2026-08-30T00:00:00.000Z");
    const result = classifyReapplication({ reapplyDate: ontemNoBanco }, meiaNoite);
    expect(result.overdue).toBe(true);
  });

  // ── Antecedência configurável (G2 — RN-CFG-006) ──
  describe("com a antecedência da fazenda", () => {
    const tz = "America/Sao_Paulo";

    it("com 15 dias, a reaplicação daqui a 10 dias vira alerta", () => {
      const daquiA10Dias = new Date("2026-09-08T00:00:00.000Z");
      const result = classifyReapplication({ reapplyDate: daquiA10Dias }, hoje, tz, 15);
      expect(result.isAlert).toBe(true);
      expect(result.overdue).toBe(false);
    });

    it("com 0 dias, só a de hoje e as vencidas são alerta", () => {
      const hojeNoBanco = new Date("2026-08-29T00:00:00.000Z");
      const amanha = new Date("2026-08-30T00:00:00.000Z");
      const ontem = new Date("2026-08-28T00:00:00.000Z");
      expect(classifyReapplication({ reapplyDate: hojeNoBanco }, hoje, tz, 0).isAlert).toBe(true);
      expect(classifyReapplication({ reapplyDate: amanha }, hoje, tz, 0).isAlert).toBe(false);
      expect(classifyReapplication({ reapplyDate: ontem }, hoje, tz, 0)).toEqual({
        isAlert: true,
        overdue: true,
      });
    });
  });
});


describe("carência (D-12)", () => {
  it("fim = data + dias; sem dias informados = sem fim (não é zero)", () => {
    expect(withdrawalEndDate("2026-09-10", 30)).toBe("2026-10-10");
    expect(withdrawalEndDate("2026-09-10", 0)).toBe("2026-09-10");
    expect(withdrawalEndDate("2026-09-10", null)).toBeNull();
  });

  const record = (tag: string, applicationDate: string, end: string, animalId = tag) => ({
    animalId,
    tag,
    productName: "Ivermectina",
    applicationDate,
    withdrawalEndDate: end,
  });

  it("avisa quem está em carência na data da venda", () => {
    const conflicts = findWithdrawalConflicts("2026-10-01", [
      record("BR-2", "2026-09-10", "2026-10-10"), // em carência
      record("BR-1", "2026-09-10", "2026-10-01"), // termina no dia: liberado
      record("BR-3", "2026-10-05", "2026-11-05"), // aplicado depois da venda
    ]);
    expect(conflicts.map((c) => c.tag)).toEqual(["BR-2"]);
  });

  it("um aviso por animal, com o fim mais distante; ordenado por brinco", () => {
    const conflicts = findWithdrawalConflicts("2026-10-01", [
      record("BR-10", "2026-09-01", "2026-10-05", "a"),
      record("BR-10", "2026-09-20", "2026-10-20", "a"),
      record("BR-9", "2026-09-20", "2026-10-02", "b"),
    ]);
    expect(conflicts.map((c) => [c.tag, c.withdrawalEndDate])).toEqual([
      ["BR-9", "2026-10-02"],
      ["BR-10", "2026-10-20"],
    ]);
  });
});

describe("lembrete (D-40)", () => {
  it("só sai ao reaplicar, dispensar ou sem animal ativo — nunca pelo tempo", () => {
    expect(isReminderOpen({ dismissed: false, reapplied: false, activeAnimals: 3 })).toBe(true);
    expect(isReminderOpen({ dismissed: true, reapplied: false, activeAnimals: 3 })).toBe(false);
    expect(isReminderOpen({ dismissed: false, reapplied: true, activeAnimals: 3 })).toBe(false);
    expect(isReminderOpen({ dismissed: false, reapplied: false, activeAnimals: 0 })).toBe(false);
  });
});
