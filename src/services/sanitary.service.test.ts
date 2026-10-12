import { describe, it, expect } from "vitest";
import { classifyReapplication } from "./sanitary.service.js";

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
});
