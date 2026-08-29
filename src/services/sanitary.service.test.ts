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
});