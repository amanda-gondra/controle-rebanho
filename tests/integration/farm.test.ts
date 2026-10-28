import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { createLoggedClient } from "../helpers/client.js";
import { createAnimal, createProduct, daysFromToday } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";
import { FARM_DEFAULTS } from "../../src/lib/farm.js";

// CONFIGURAÇÕES DA FAZENDA (G2) — critérios de aceitação da
// "Espec — Configurações da fazenda" (números entre parênteses).

const t = useTestApp();

const patchFarm = (payload: unknown) =>
  t.client.inject({ method: "PATCH", url: "/farm", payload: payload as object });

const fieldOf = (response: { json: () => { errors?: { field: string }[] } }) =>
  response.json().errors?.map((e) => e.field);

describe("GET /farm", () => {
  it("conta nova já vem com todos os padrões (1) — e eles batem com o banco", async () => {
    const response = await t.client.inject({ url: "/farm" });

    expect(response.statusCode).toBe(200);
    const farm = response.json();
    expect(farm).toMatchObject({
      id: t.client.farm.id,
      name: t.client.farm.name,
      country: "BR",
      timezone: FARM_DEFAULTS.timezone,
      currency: FARM_DEFAULTS.currency,
      weightUnit: FARM_DEFAULTS.weightUnit,
    });
    // Os @default do schema.prisma (banco) e FARM_DEFAULTS (código) são iguais
    expect(farm.settings).toEqual(FARM_DEFAULTS.settings);
    expect(farm.defaults).toEqual(FARM_DEFAULTS.settings);
  });

  it("GET /auth/me traz as mesmas configurações (uma chamada só ao abrir o app)", async () => {
    await patchFarm({ reapplyAlertDays: 12 });
    const me = await t.client.inject({ url: "/auth/me" });
    expect(me.json().farm.settings.reapplyAlertDays).toBe(12);
  });
});

describe("PATCH /farm", () => {
  it("altera só o que foi enviado", async () => {
    const response = await patchFarm({ name: "  Fazenda Boa Vista  ", reapplyAlertDays: 15 });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Fazenda Boa Vista",
      timezone: FARM_DEFAULTS.timezone,
      settings: { ...FARM_DEFAULTS.settings, reapplyAlertDays: 15 },
    });
  });

  it("aceita fuso do Brasil e o fator da arroba com 2 casas", async () => {
    const response = await patchFarm({
      timezone: "America/Cuiaba",
      arrobaLiveFactorKg: 30.5,
      preferredPriceUnit: "PER_ARROBA",
      defaultCastrated: true,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      timezone: "America/Cuiaba",
      settings: { arrobaLiveFactorKg: 30.5, preferredPriceUnit: "PER_ARROBA", defaultCastrated: true },
    });
  });

  it("voltar ao padrão = mandar o valor padrão (11)", async () => {
    await patchFarm({ arrobaLiveFactorKg: 32 });
    const response = await patchFarm({ arrobaLiveFactorKg: FARM_DEFAULTS.settings.arrobaLiveFactorKg });
    expect(response.json().settings.arrobaLiveFactorKg).toBe(30);
  });

  it.each([0, -1, 100, 30.123, "30"])("fator da arroba %s → 400 no campo (5)", async (value) => {
    const response = await patchFarm({ arrobaLiveFactorKg: value });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
    expect(fieldOf(response)).toContain("arrobaLiveFactorKg");
  });

  it.each([-1, 61, 2.5])("antecedência %s → 400 no campo (6)", async (value) => {
    const response = await patchFarm({ reapplyAlertDays: value });
    expect(response.statusCode).toBe(400);
    expect(fieldOf(response)).toContain("reapplyAlertDays");
  });

  it("aceita os limites: antecedência 0 e 60", async () => {
    expect((await patchFarm({ reapplyAlertDays: 0 })).statusCode).toBe(200);
    expect((await patchFarm({ reapplyAlertDays: 60 })).statusCode).toBe(200);
  });

  it.each(["America/Nao_Existe", "Europe/Lisbon", "UTC", ""])(
    "fuso %s → 400 (só fusos do Brasil — 8, D-31)",
    async (timezone) => {
      const response = await patchFarm({ timezone });
      expect(response.statusCode).toBe(400);
      expect(fieldOf(response)).toContain("timezone");
    },
  );

  it("nome vazio → 400", async () => {
    const response = await patchFarm({ name: "   " });
    expect(response.statusCode).toBe(400);
    expect(fieldOf(response)).toContain("name");
  });

  it("corpo vazio → 400", async () => {
    const response = await patchFarm({});
    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["country", "US"],
    ["currency", "USD"],
    ["weightUnit", "lb"],
  ])("%s não é editável na 1.0 (D-30) → 400 e nada muda", async (field, value) => {
    const response = await patchFarm({ [field]: value });
    expect(response.statusCode).toBe(400);

    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: t.client.farm.id } });
    expect(farm).toMatchObject({ country: "BR", currency: "BRL", weightUnit: "kg" });
  });
});

describe("isolamento (9, RN-CFG-010)", () => {
  it("mandar o id de outra fazenda é recusado e a outra fazenda não muda", async () => {
    const farmB = await createLoggedClient(t.app, "Fazenda B");

    const response = await patchFarm({ id: farmB.farm.id, name: "Invadida" });
    expect(response.statusCode).toBe(400);

    const b = await prisma.farm.findUniqueOrThrow({ where: { id: farmB.farm.id } });
    expect(b.name).toBe("Fazenda B");
  });

  it("cada fazenda vê e altera só as próprias configurações", async () => {
    const farmB = await createLoggedClient(t.app, "Fazenda B");
    await patchFarm({ reapplyAlertDays: 30 });

    const fromB = await farmB.inject({ url: "/farm" });
    expect(fromB.json()).toMatchObject({ id: farmB.farm.id, name: "Fazenda B" });
    expect(fromB.json().settings.reapplyAlertDays).toBe(7);
  });
});

describe("efeito das configurações", () => {
  async function applicationWithReapply(reapplyDate: string) {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const response = await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: daysFromToday(-1), reapplyDate, animalIds: [animal.id] },
    });
    expect(response.statusCode).toBe(201);
  }

  it("aumentar a antecedência de 7 para 15 mostra na hora a reaplicação daqui a 10 dias (4, RN-CFG-006)", async () => {
    await applicationWithReapply(daysFromToday(10));

    expect((await t.client.inject({ url: "/alerts" })).json()).toHaveLength(0);
    await patchFarm({ reapplyAlertDays: 15 });
    expect((await t.client.inject({ url: "/alerts" })).json()).toHaveLength(1);
  });

  it("o fuso novo passa a valer na sessão na hora (RN-CFG-007)", async () => {
    // Noronha (UTC−2) e Rio Branco (UTC−5) ficam 3 horas separados: em algum
    // momento do dia o "hoje" deles é diferente. Basta conferir que o fuso
    // novo passou a ser o usado pela sessão.
    await patchFarm({ timezone: "America/Rio_Branco" });
    const me = await t.client.inject({ url: "/auth/me" });
    expect(me.json().farm.timezone).toBe("America/Rio_Branco");
  });
});
