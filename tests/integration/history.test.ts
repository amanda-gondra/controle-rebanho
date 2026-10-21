import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { addWeighing, buyAnimal, createAnimal, createProduct, daysFromToday, sellAnimal } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

// HISTÓRICO DO ANIMAL (2026-10-18): brinco sem diferenciar maiúsculas (D-29),
// troca de brinco (D-19), linha do tempo (D-28), autoria e trilha (D-51/D-54),
// origem e entrada (D-52). Números = critérios da "Espec — Animais".

const t = useTestApp();

type Event = { type: string; fromValue: string | null; toValue: string | null; reason: string | null; effectiveDate: string; userName: string | null };
const history = async (id: string) =>
  (await t.client.inject({ url: `/animals/${id}/history` })).json() as { items: Event[]; total: number; createdAt: string };

const changeTag = (id: string, payload: Record<string, unknown>) =>
  t.client.inject({ method: "POST", url: `/animals/${id}/tag-changes`, payload });

describe("brinco sem diferenciar maiúsculas (D-29)", () => {
  it("'br-1' e 'BR-1' são o mesmo brinco no cadastro", async () => {
    await createAnimal(t.client, { tag: "BR-1" });
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "br-1", sex: "MALE", category: "CALF" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DUPLICATE_TAG");
  });

  it("o banco também recusa (índice em lower(tag)), mesmo sem passar pela API", async () => {
    const animal = await createAnimal(t.client, { tag: "BR-2" });
    await expect(
      prisma.animal.create({
        data: { farmId: t.client.farm.id, tag: "br-2", sex: "MALE", category: "CALF" },
      }),
    ).rejects.toThrow();
    expect(animal.tag).toBe("BR-2");
  });

  it("compra em lote: animal novo com brinco que só difere na maiúscula é recusado", async () => {
    await createAnimal(t.client, { tag: "AB-9" });
    const response = await t.client.inject({
      method: "POST",
      url: "/trades",
      payload: {
        type: "PURCHASE",
        date: "2026-01-10",
        priceUnit: "PER_HEAD",
        items: [
          { newAnimal: { tag: "ab-9", sex: "FEMALE", category: "COW" }, unitPrice: 2000 },
          { newAnimal: { tag: "N-1", sex: "FEMALE", category: "COW" }, unitPrice: 2000 },
          { newAnimal: { tag: "n-1", sex: "FEMALE", category: "COW" }, unitPrice: 2000 },
        ],
      },
    });
    expect(response.statusCode).toBe(422);
    const params = response.json().errors.map((error: { field: string; params: { reason: string } }) => [error.field, error.params.reason]);
    expect(params).toEqual([
      ["items.0.newAnimal.tag", "IN_FARM"],
      ["items.1.newAnimal.tag", "IN_LIST"],
      ["items.2.newAnimal.tag", "IN_LIST"],
    ]);
  });
});

describe("troca de brinco (D-19)", () => {
  it("troca guardando o antigo; pesagens continuam no animal (21)", async () => {
    const animal = await createAnimal(t.client, { tag: "BR-104" });
    await addWeighing(t.client, animal.id, "2026-01-01", 200);
    await addWeighing(t.client, animal.id, "2026-02-01", 230);
    await addWeighing(t.client, animal.id, "2026-03-01", 260);

    const response = await changeTag(animal.id, { newTag: " BR-210 ", reason: "LOST", date: "2026-03-05" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: animal.id, tag: "BR-210", previousTag: "BR-104" });

    const detail = (await t.client.inject({ url: `/animals/${animal.id}` })).json();
    expect(detail).toMatchObject({ tag: "BR-210", previousTag: "BR-104" });
    const weighings = (await t.client.inject({ url: `/animals/${animal.id}/weighings` })).json();
    expect(weighings).toHaveLength(3);

    const { items } = await history(animal.id);
    expect(items[0]).toMatchObject({
      type: "TAG_CHANGED",
      fromValue: "BR-104",
      toValue: "BR-210",
      reason: "LOST",
      effectiveDate: "2026-03-05",
    });
    expect(items[0].userName).toMatch(/^Usuário /);
  });

  it("brinco já usado → DUPLICATE_TAG e nada muda (22)", async () => {
    const animal = await createAnimal(t.client, { tag: "BR-104" });
    await createAnimal(t.client, { tag: "BR-210" });
    const response = await changeTag(animal.id, { newTag: "br-210", reason: "LOST", date: "2026-03-05" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DUPLICATE_TAG");
    expect((await t.client.inject({ url: `/animals/${animal.id}` })).json().tag).toBe("BR-104");
    expect((await history(animal.id)).total).toBe(0);
  });

  it("corrigir só a maiúscula do próprio brinco é permitido; igual é recusado", async () => {
    const animal = await createAnimal(t.client, { tag: "br-5" });
    expect((await changeTag(animal.id, { newTag: "br-5", reason: "TYPO", date: daysFromToday(0) })).json().errors[0].code).toBe("SAME_TAG");
    const fixed = await changeTag(animal.id, { newTag: "BR-5", reason: "TYPO", date: daysFromToday(0) });
    expect(fixed.statusCode).toBe(200);
  });

  it("motivo obrigatório e data não futura", async () => {
    const animal = await createAnimal(t.client);
    expect((await changeTag(animal.id, { newTag: "X-1", date: "2026-01-01" })).statusCode).toBe(400);
    expect((await changeTag(animal.id, { newTag: "X-1", reason: "OTHER", date: daysFromToday(2) })).statusCode).toBe(400);
  });
});

describe("linha do tempo (D-28, RN-ANIMAL-017)", () => {
  it("categoria, sexo e nascimento: antes, depois e quem (13)", async () => {
    const animal = await createAnimal(t.client, { tag: "L-1", sex: "MALE", category: "CALF" });
    await t.client.inject({ method: "PUT", url: `/animals/${animal.id}`, payload: { category: "YEARLING", breed: "Nelore" } });
    await t.client.inject({
      method: "PUT",
      url: `/animals/${animal.id}`,
      payload: { birthPrecision: "MONTH_YEAR", birthDate: "2025-03-01" },
    });
    await t.client.inject({ method: "PUT", url: `/animals/${animal.id}`, payload: { sex: "FEMALE", category: "HEIFER" } });

    const { items, total } = await history(animal.id);
    expect(total).toBe(4); // raça não entra na linha do tempo
    expect(items.map((event) => [event.type, event.fromValue, event.toValue])).toEqual([
      ["SEX_CHANGED", "MALE", "FEMALE"],
      ["CATEGORY_CHANGED", "YEARLING", "HEIFER"],
      ["BIRTH_CHANGED", JSON.stringify({ precision: "UNKNOWN" }), JSON.stringify({ precision: "MONTH_YEAR", date: "2025-03-01" })],
      ["CATEGORY_CHANGED", "CALF", "YEARLING"],
    ]);
    expect(items.every((event) => /^Usuário /.test(event.userName ?? ""))).toBe(true);
  });

  it("morte e reversão ficam registradas com a data da saída (20)", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "DEAD", exitDate: "2026-10-10", deathCauseCertainty: "SUSPECTED", deathCause: "picada" },
    });
    await t.client.inject({ method: "PATCH", url: `/animals/${animal.id}/status`, payload: { status: "ACTIVE" } });

    const { items } = await history(animal.id);
    expect(items).toHaveLength(2);
    expect(JSON.parse(items[1].toValue!)).toEqual({ status: "DEAD", exitDate: "2026-10-10", certainty: "SUSPECTED", cause: "picada" });
    expect(items[1].effectiveDate).toBe("2026-10-10");
    expect(JSON.parse(items[0].toValue!)).toEqual({ status: "ACTIVE" });
  });

  it("venda e desfazer venda entram na linha do tempo", async () => {
    const animal = await createAnimal(t.client);
    const sale = await sellAnimal(t.client, animal.id, "2026-05-10");
    await t.client.inject({ method: "PATCH", url: `/trades/${sale.id}`, payload: { date: "2026-05-11" } });
    await t.client.inject({ method: "DELETE", url: `/trades/${sale.id}` });

    const { items } = await history(animal.id);
    expect(items.map((event) => JSON.parse(event.toValue!).status)).toEqual(["ACTIVE", "SOLD", "SOLD"]);
    expect(JSON.parse(items[1].toValue!).exitDate).toBe("2026-05-11");
  });

  it("paginada, mais recente primeiro", async () => {
    const animal = await createAnimal(t.client, { sex: "MALE", category: "CALF" });
    for (const category of ["YEARLING", "ADULT_MALE", "BULL"]) {
      await t.client.inject({ method: "PUT", url: `/animals/${animal.id}`, payload: { category } });
    }
    const page = (await t.client.inject({ url: `/animals/${animal.id}/history?page=2&pageSize=2` })).json();
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.items.map((event: Event) => event.toValue)).toEqual(["YEARLING"]);
  });
});

describe("origem e entrada (D-52)", () => {
  it("nascido na fazenda com entrada; entrada antes do nascimento é recusada", async () => {
    const ok = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: {
        tag: "O-1",
        sex: "FEMALE",
        category: "CALF",
        birthPrecision: "DAY_MONTH_YEAR",
        birthDate: "2026-02-10",
        origin: "BORN_ON_FARM",
        entryDate: "2026-02-10",
      },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ origin: "BORN_ON_FARM", entryDate: "2026-02-10T00:00:00.000Z" });

    const bad = await t.client.inject({
      method: "PUT",
      url: `/animals/${ok.json().id}`,
      payload: { entryDate: "2026-02-01" },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().errors[0]).toMatchObject({ field: "entryDate", code: "ENTRY_DATE_OUT_OF_RANGE" });
  });

  it("'comprado' só pela compra registrada; a compra preenche origem e entrada", async () => {
    const direct = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "O-2", sex: "MALE", category: "CALF", origin: "PURCHASED" },
    });
    expect(direct.statusCode).toBe(400);
    expect(direct.json().errors[0].code).toBe("ORIGIN_FROM_PURCHASE");

    const animal = await createAnimal(t.client, { tag: "O-3" });
    const purchase = await buyAnimal(t.client, animal.id, "2026-01-15");
    const bought = (await t.client.inject({ url: `/animals/${animal.id}` })).json();
    expect(bought).toMatchObject({ origin: "PURCHASED", entryDate: "2026-01-15T00:00:00.000Z" });

    // Com compra registrada, a origem não se edita pela ficha
    const edit = await t.client.inject({ method: "PUT", url: `/animals/${animal.id}`, payload: { origin: "RECEIVED" } });
    expect(edit.statusCode).toBe(400);
    expect(edit.json().errors[0].code).toBe("ORIGIN_FROM_PURCHASE");

    // Corrigir a data da compra move a entrada; desfazer apaga
    await t.client.inject({ method: "PATCH", url: `/trades/${purchase.id}`, payload: { date: "2026-01-12" } });
    expect((await t.client.inject({ url: `/animals/${animal.id}` })).json().entryDate).toBe("2026-01-12T00:00:00.000Z");
    await t.client.inject({ method: "DELETE", url: `/trades/${purchase.id}` });
    expect((await t.client.inject({ url: `/animals/${animal.id}` })).json()).toMatchObject({ origin: "NOT_INFORMED", entryDate: null });

    const types = (await history(animal.id)).items.map((event) => event.type);
    expect(types).toEqual(["ORIGIN_CHANGED", "ORIGIN_CHANGED", "ORIGIN_CHANGED"]);
  });

  it("origem informada antes da compra não é sobrescrita", async () => {
    const animal = (
      await t.client.inject({
        method: "POST",
        url: "/animals",
        payload: { tag: "O-4", sex: "MALE", category: "CALF", origin: "RECEIVED", entryDate: "2026-01-01" },
      })
    ).json();
    await buyAnimal(t.client, animal.id, "2026-01-20");
    expect((await t.client.inject({ url: `/animals/${animal.id}` })).json()).toMatchObject({ origin: "RECEIVED" });
  });

  it("compra em lote cadastra os novos como comprados, com entrada e autor", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/trades",
      payload: {
        type: "PURCHASE",
        date: "2026-02-02",
        priceUnit: "PER_HEAD",
        items: [{ newAnimal: { tag: "NV-1", sex: "FEMALE", category: "COW" }, unitPrice: 2500 }],
      },
    });
    expect(response.statusCode).toBe(201);
    const animal = await prisma.animal.findFirstOrThrow({ where: { farmId: t.client.farm.id, tag: "NV-1" } });
    expect(animal).toMatchObject({ origin: "PURCHASED", createdById: t.client.user.id });
    expect(animal.entryDate?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("autoria e trilha (D-51/D-54)", () => {
  it("pesagem, aplicação e animal guardam quem registrou", async () => {
    const animal = await createAnimal(t.client);
    const weighing = await addWeighing(t.client, animal.id, "2026-01-01", 300);
    const product = await createProduct(t.client);
    const application = await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: "2026-01-02", animalIds: [animal.id] },
    });
    const userId = t.client.user.id;
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).createdById).toBe(userId);
    expect((await prisma.weighing.findUniqueOrThrow({ where: { id: weighing.id } })).createdById).toBe(userId);
    expect((await prisma.application.findUniqueOrThrow({ where: { id: application.json().id } })).createdById).toBe(userId);
  });

  it("exclusões e desfazer ficam na trilha com o que sumiu", async () => {
    const animal = await createAnimal(t.client, { tag: "DEL-1" });
    const weighing = await addWeighing(t.client, animal.id, "2026-01-01", 300);
    await t.client.inject({ method: "DELETE", url: `/animals/${animal.id}/weighings/${weighing.id}` });
    const impact = (await t.client.inject({ url: `/animals/${animal.id}/delete-impact` })).json();
    expect(impact).toEqual({ weighings: 0, applications: 0, hasTransactions: false });
    await t.client.inject({ method: "DELETE", url: `/animals/${animal.id}` });

    const sold = await createAnimal(t.client, { tag: "S-1" });
    const sale = await sellAnimal(t.client, sold.id, "2026-03-01");
    await t.client.inject({ method: "DELETE", url: `/trades/${sale.id}` });
    await t.client.inject({ method: "PATCH", url: "/farm", payload: { reapplyAlertDays: 10 } });

    const logs = await prisma.auditLog.findMany({ where: { farmId: t.client.farm.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((log) => log.action)).toEqual([
      "WEIGHING_DELETED",
      "ANIMAL_DELETED",
      "TRADE_UNDONE",
      "FARM_SETTINGS_CHANGED",
    ]);
    expect(logs[1].details).toMatchObject({ tag: "DEL-1" });
    expect(logs[2].details).toMatchObject({ type: "SALE", tags: ["S-1"] });
    expect(logs[3].details).toEqual({ fields: ["reapplyAlertDays"] });
    expect(logs.every((log) => log.userId === t.client.user.id)).toBe(true);
    // Nada sensível na trilha
    expect(JSON.stringify(logs)).not.toMatch(/password|token|senha/i);
  });

  it("a trilha não pode ser alterada (o banco recusa UPDATE)", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({ method: "DELETE", url: `/animals/${animal.id}` });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { farmId: t.client.farm.id } });
    await expect(prisma.auditLog.update({ where: { id: log.id }, data: { action: "NADA" } })).rejects.toThrow();
  });

  it("delete-impact mostra o que some junto e se há negociação", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-01-01", 300);
    await addWeighing(t.client, animal.id, "2026-02-01", 320);
    await buyAnimal(t.client, animal.id, "2026-01-01");
    const impact = (await t.client.inject({ url: `/animals/${animal.id}/delete-impact` })).json();
    expect(impact).toEqual({ weighings: 2, applications: 0, hasTransactions: true });
  });
});
