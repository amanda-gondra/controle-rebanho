import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { addWeighing, createAnimal, createProduct, daysFromToday, sellAnimal } from "../helpers/factories.js";
import { createLoggedClient } from "../helpers/client.js";
import { prisma } from "../../src/lib/prisma.js";

// G5 — entrega 1: SAÍDA DO ANIMAL (D-27) e PESAGENS (D-08, D-33).
// Números entre parênteses = critérios da "Espec — Animais" (16–20) e
// da "Espec — Pesagens e GMD".

const t = useTestApp();

const setStatus = (id: string, payload: Record<string, unknown>) =>
  t.client.inject({ method: "PATCH", url: `/animals/${id}/status`, payload });

const weigh = (id: string, date: string, weightKg = 300) =>
  t.client.inject({ method: "POST", url: `/animals/${id}/weighings`, payload: { date, weightKg } });

const fieldErrors = (response: { json: () => { errors?: unknown[] } }) => response.json().errors;

describe("registrar morte e venda manual (D-27)", () => {
  it("morte grava data, causa e certeza (16)", async () => {
    const animal = await createAnimal(t.client);
    const response = await setStatus(animal.id, {
      status: "DEAD",
      exitDate: "2026-10-10",
      deathCause: "  picada de cobra ",
      deathCauseCertainty: "SUSPECTED",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "DEAD",
      exitDate: "2026-10-10T00:00:00.000Z",
      deathCause: "picada de cobra",
      deathCauseCertainty: "SUSPECTED",
    });
  });

  it("certeza padrão é 'não informada'; causa é opcional", async () => {
    const animal = await createAnimal(t.client);
    const response = await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10" });
    expect(response.json()).toMatchObject({ deathCause: null, deathCauseCertainty: "NOT_INFORMED" });
  });

  it("venda manual grava só a data (sem causa)", async () => {
    const animal = await createAnimal(t.client);
    const response = await setStatus(animal.id, {
      status: "SOLD",
      exitDate: "2026-10-10",
      deathCause: "não se aplica",
    });
    expect(response.json()).toMatchObject({
      status: "SOLD",
      exitDate: "2026-10-10T00:00:00.000Z",
      deathCause: null,
      deathCauseCertainty: null,
    });
  });

  it("sair sem data → 400 REQUIRED no campo exitDate", async () => {
    const animal = await createAnimal(t.client);
    const response = await setStatus(animal.id, { status: "DEAD" });
    expect(response.statusCode).toBe(400);
    expect(fieldErrors(response)).toEqual([expect.objectContaining({ field: "exitDate", code: "REQUIRED" })]);
  });

  it("data de saída no futuro → 400 FUTURE_DATE", async () => {
    const animal = await createAnimal(t.client);
    const response = await setStatus(animal.id, { status: "DEAD", exitDate: daysFromToday(3) });
    expect(fieldErrors(response)).toEqual([expect.objectContaining({ field: "exitDate", code: "FUTURE_DATE" })]);
  });

  it("pesagem depois da data de saída → 422 EXIT_DATE_CONFLICT citando a pesagem (17)", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-10-12", 300);

    const response = await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10" });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("EXIT_DATE_CONFLICT");
    expect(fieldErrors(response)).toEqual([
      expect.objectContaining({ field: "exitDate", params: { kind: "WEIGHING", date: "2026-10-12" } }),
    ]);
    const saved = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(saved).toMatchObject({ status: "ACTIVE", exitDate: null });
  });

  it.each([
    ["nascimento", "BIRTH"],
    ["aplicação", "APPLICATION"],
  ])("saída antes de %s → EXIT_DATE_CONFLICT (%s)", async (_label, kind) => {
    const animal = await createAnimal(t.client, { birthDate: "2026-05-01", birthPrecision: "DAY_MONTH_YEAR" });
    if (kind === "APPLICATION") {
      const product = await createProduct(t.client);
      await t.client.inject({
        method: "POST",
        url: "/applications",
        payload: { productId: product.id, date: "2026-09-01", animalIds: [animal.id] },
      });
    }
    const exitDate = kind === "BIRTH" ? "2026-04-01" : "2026-08-01";
    const response = await setStatus(animal.id, { status: "DEAD", exitDate });
    expect(fieldErrors(response)).toEqual([expect.objectContaining({ params: expect.objectContaining({ kind }) })]);
  });

  it("morto ⇄ vendido direto → 409 INVALID_STATUS_TRANSITION", async () => {
    const animal = await createAnimal(t.client);
    await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10" });
    const response = await setStatus(animal.id, { status: "SOLD", exitDate: "2026-10-10" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("morto de novo = corrigir data e causa da morte", async () => {
    const animal = await createAnimal(t.client);
    await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10" });
    const response = await setStatus(animal.id, {
      status: "DEAD",
      exitDate: "2026-10-09",
      deathCauseCertainty: "CONFIRMED",
    });
    expect(response.json()).toMatchObject({ exitDate: "2026-10-09T00:00:00.000Z", deathCauseCertainty: "CONFIRMED" });
  });

  it("reverter morte registrada por engano apaga data, causa e certeza (20)", async () => {
    const animal = await createAnimal(t.client);
    await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10", deathCause: "x" });
    const response = await setStatus(animal.id, { status: "ACTIVE" });
    expect(response.json()).toMatchObject({
      status: "ACTIVE",
      exitDate: null,
      deathCause: null,
      deathCauseCertainty: null,
    });
  });

  it("com venda registrada, nem o botão de situação muda nada (19, D-06)", async () => {
    const animal = await createAnimal(t.client);
    await sellAnimal(t.client, animal.id, "2026-10-01");
    for (const status of ["ACTIVE", "DEAD", "SOLD"]) {
      const response = await setStatus(animal.id, { status, exitDate: "2026-10-01" });
      expect(response.json().code, status).toBe("ANIMAL_HAS_SALE");
    }
  });

  it("o banco não aceita animal ativo com saída nem causa em animal vivo", async () => {
    const animal = await createAnimal(t.client);
    await expect(
      prisma.animal.update({ where: { id: animal.id }, data: { exitDate: new Date("2026-01-01") } }),
    ).rejects.toThrow();
    await expect(
      prisma.animal.update({ where: { id: animal.id }, data: { deathCause: "x" } }),
    ).rejects.toThrow();
  });
});

describe("venda registrada é a saída do animal", () => {
  it("registrar venda grava a saída; corrigir a data muda; desfazer apaga", async () => {
    const animal = await createAnimal(t.client);
    const exitOf = async () => (await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).exitDate;

    const trade = await sellAnimal(t.client, animal.id, "2026-10-01");
    expect(await exitOf()).toEqual(new Date("2026-10-01"));

    await t.client.inject({ method: "PATCH", url: `/trades/${trade.id}`, payload: { date: "2026-10-03" } });
    expect(await exitOf()).toEqual(new Date("2026-10-03"));

    await t.client.inject({ method: "DELETE", url: `/trades/${trade.id}` });
    expect(await exitOf()).toBeNull();
  });

  it("venda antes de uma pesagem já registrada → 422 EXIT_DATE_CONFLICT", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-10-05", 380);
    const response = await t.client.inject({
      method: "POST",
      url: "/trades",
      payload: {
        type: "SALE",
        date: "2026-10-01",
        priceUnit: "PER_KG",
        items: [{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }],
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("TRADE_ITEM_ERRORS");
    expect(response.json().errors[0]).toMatchObject({
      code: "EXIT_DATE_CONFLICT",
      params: { kind: "WEIGHING", date: "2026-10-05" },
    });
    expect(await prisma.trade.count()).toBe(0);
  });
});

describe("nada depois da saída (RN-ANIMAL-012)", () => {
  it("pesagem depois da morte → 422 WEIGHING_DATE_OUT_OF_RANGE; no dia da morte pode (18)", async () => {
    const animal = await createAnimal(t.client);
    await setStatus(animal.id, { status: "DEAD", exitDate: "2026-10-10" });

    const after = await weigh(animal.id, "2026-10-11");
    expect(after.statusCode).toBe(422);
    expect(fieldErrors(after)).toEqual([
      expect.objectContaining({ field: "date", params: { reason: "AFTER_EXIT", date: "2026-10-10" } }),
    ]);
    expect((await weigh(animal.id, "2026-10-10")).statusCode).toBe(201);
  });

  it("editar pesagem para depois da saída também é recusado", async () => {
    const animal = await createAnimal(t.client);
    const weighing = await addWeighing(t.client, animal.id, "2026-10-01", 300);
    await setStatus(animal.id, { status: "SOLD", exitDate: "2026-10-05" });

    const response = await t.client.inject({
      method: "PUT",
      url: `/animals/${animal.id}/weighings/${weighing.id}`,
      payload: { date: "2026-10-06", weightKg: 300 },
    });
    expect(response.json().code).toBe("WEIGHING_DATE_OUT_OF_RANGE");
  });

  it("pesagem antes do nascimento (com dia certo) → WEIGHING_DATE_OUT_OF_RANGE", async () => {
    const animal = await createAnimal(t.client, { birthDate: "2026-05-10", birthPrecision: "DAY_MONTH_YEAR" });
    const response = await weigh(animal.id, "2026-05-09");
    expect(fieldErrors(response)).toEqual([
      expect.objectContaining({ params: { reason: "BEFORE_BIRTH", date: "2026-05-10" } }),
    ]);
  });

  it("aplicação com animal que já tinha saído → 422 ANIMALS_NOT_IN_HERD_ON_DATE e nada é gravado", async () => {
    const product = await createProduct(t.client);
    const alive = await createAnimal(t.client, { tag: "A-1" });
    const dead = await createAnimal(t.client, { tag: "M-1" });
    await setStatus(dead.id, { status: "DEAD", exitDate: "2026-10-01" });

    const response = await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: "2026-10-05", animalIds: [alive.id, dead.id] },
    });
    expect(response.statusCode).toBe(422);
    expect(fieldErrors(response)).toEqual([
      expect.objectContaining({ field: "animalIds", params: { tags: "M-1", count: 1 } }),
    ]);
    expect(await prisma.application.count()).toBe(0);
  });

  it("mudar a data de uma aplicação para depois da saída de um animal dela é recusado", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const created = await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: "2026-09-01", animalIds: [animal.id] },
    });
    await setStatus(animal.id, { status: "SOLD", exitDate: "2026-09-10" });

    const response = await t.client.inject({
      method: "PUT",
      url: `/applications/${created.json().id}`,
      payload: { productId: product.id, date: "2026-09-15" },
    });
    expect(response.json().code).toBe("ANIMALS_NOT_IN_HERD_ON_DATE");
  });
});

describe("pesagens: uma por dia e origem (D-33, D-08)", () => {
  it("segunda pesagem no mesmo dia → 409 DUPLICATE_WEIGHING_DATE e fica só a primeira (9)", async () => {
    const animal = await createAnimal(t.client);
    expect((await weigh(animal.id, "2026-10-01", 300)).statusCode).toBe(201);
    const second = await weigh(animal.id, "2026-10-01", 310);
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("DUPLICATE_WEIGHING_DATE");
    expect(await prisma.weighing.count({ where: { animalId: animal.id } })).toBe(1);
  });

  it("dois toques rápidos geram UMA pesagem (9)", async () => {
    const animal = await createAnimal(t.client);
    const results = await Promise.all([weigh(animal.id, "2026-10-01"), weigh(animal.id, "2026-10-01")]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.weighing.count({ where: { animalId: animal.id } })).toBe(1);
  });

  it("mover uma pesagem para um dia que já tem outra → 409", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-10-01", 300);
    const other = await addWeighing(t.client, animal.id, "2026-10-02", 305);
    const response = await t.client.inject({
      method: "PUT",
      url: `/animals/${animal.id}/weighings/${other.id}`,
      payload: { date: "2026-10-01", weightKg: 305 },
    });
    expect(response.json().code).toBe("DUPLICATE_WEIGHING_DATE");
  });

  it("animais diferentes podem ser pesados no mesmo dia", async () => {
    const a = await createAnimal(t.client);
    const b = await createAnimal(t.client);
    expect((await weigh(a.id, "2026-10-01")).statusCode).toBe(201);
    expect((await weigh(b.id, "2026-10-01")).statusCode).toBe(201);
  });

  it("pesagem digitada nasce como MANUAL", async () => {
    const animal = await createAnimal(t.client);
    expect((await weigh(animal.id, "2026-10-01")).json().source).toBe("MANUAL");
  });

  it("pesagem de compra/venda não se edita nem se exclui direto → 409 WEIGHING_FROM_TRADE (RN-PES-009)", async () => {
    const animal = await createAnimal(t.client);
    await sellAnimal(t.client, animal.id, "2026-10-01");
    const fromSale = await prisma.weighing.findFirstOrThrow({ where: { animalId: animal.id } });
    expect(fromSale.source).toBe("SALE");
    const url = `/animals/${animal.id}/weighings/${fromSale.id}`;

    const edit = await t.client.inject({ method: "PUT", url, payload: { date: "2026-10-01", weightKg: 400 } });
    expect(edit.json().code).toBe("WEIGHING_FROM_TRADE");
    const remove = await t.client.inject({ method: "DELETE", url });
    expect(remove.json().code).toBe("WEIGHING_FROM_TRADE");
    expect(await prisma.weighing.count({ where: { id: fromSale.id } })).toBe(1);
  });
});

describe("isolamento", () => {
  it("fazenda A não registra a saída de um animal da fazenda B", async () => {
    const farmB = await createLoggedClient(t.app, "Fazenda B");
    const animalB = await createAnimal(farmB);
    const response = await setStatus(animalB.id, { status: "DEAD", exitDate: "2026-10-01" });
    expect(response.statusCode).toBe(404);
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animalB.id } })).status).toBe("ACTIVE");
  });
});
