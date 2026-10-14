import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import {
  NON_EXISTENT_ID,
  addWeighing,
  buyAnimal,
  createAnimal,
  createTrade,
  daysFromToday,
  sellAnimal,
} from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";
import { createLoggedClient } from "../helpers/client.js";

// G5 — entrega 2: NEGOCIAÇÕES (compra e venda no modelo definitivo).
// Números entre parênteses = critérios da "Espec — Compra e venda".

const t = useTestApp();

type Item = { animalId: string; liveWeightKg?: number | null; carcassWeightKg?: number | null; unitPrice: number };

const post = (payload: Record<string, unknown>) => t.client.inject({ method: "POST", url: "/trades", payload });
const sale = (items: Item[], extra: Record<string, unknown> = {}) =>
  post({ type: "SALE", date: "2026-10-01", priceUnit: "PER_KG", items, ...extra });
const patch = (id: string, payload: Record<string, unknown>) =>
  t.client.inject({ method: "PATCH", url: `/trades/${id}`, payload });
const animalOf = (id: string) => prisma.animal.findUniqueOrThrow({ where: { id } });

describe("venda em lote", () => {
  it("50 animais, preço por categoria: valores, total, vendidos, pesagens — numa operação (1)", async () => {
    const groups = [
      { sex: "MALE", category: "ADULT_MALE", count: 20, price: 11 },
      { sex: "FEMALE", category: "COW", count: 18, price: 9.5 },
      { sex: "FEMALE", category: "HEIFER", count: 12, price: 10.2 },
    ];
    const items: Item[] = [];
    let expectedCents = 0;
    for (const group of groups) {
      for (let i = 0; i < group.count; i++) {
        const animal = await createAnimal(t.client, { sex: group.sex, category: group.category });
        const liveWeightKg = 400 + items.length;
        items.push({ animalId: animal.id, liveWeightKg, unitPrice: group.price });
        expectedCents += Math.round(liveWeightKg * group.price * 100);
      }
    }

    const response = await sale(items);
    expect(response.statusCode).toBe(201);
    const trade = response.json();
    expect(trade.animalCount).toBe(50);
    expect(trade.total).toBe((expectedCents / 100).toFixed(2));
    expect(trade.pending).toBe(false);

    const sold = await prisma.animal.findMany({ where: { id: { in: items.map((i) => i.animalId) } } });
    expect(sold.every((a) => a.status === "SOLD" && a.exitDate?.toISOString().startsWith("2026-10-01"))).toBe(true);
    expect(await prisma.weighing.count({ where: { source: "SALE", date: new Date("2026-10-01") } })).toBe(50);
    expect(await prisma.tradeItem.count({ where: { weighingId: { not: null } } })).toBe(50);
  });

  it("um animal que não pode entrar: nada é gravado e a linha dele diz o motivo (2)", async () => {
    const ok = await createAnimal(t.client, { tag: "OK-1" });
    const alreadySold = await createAnimal(t.client, { tag: "VENDIDO-1" });
    await sellAnimal(t.client, alreadySold.id, "2026-09-20");
    const weighingsBefore = await prisma.weighing.count();

    const response = await sale([
      { animalId: ok.id, liveWeightKg: 400, unitPrice: 10 },
      { animalId: alreadySold.id, liveWeightKg: 400, unitPrice: 10 },
    ]);
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      code: "TRADE_ITEM_ERRORS",
      errors: [
        {
          field: "items.1.animalId",
          code: "ANIMAL_ALREADY_SOLD",
          params: { tag: "VENDIDO-1", date: "2026-09-20" },
        },
      ],
    });
    expect(await prisma.trade.count()).toBe(1);
    expect((await animalOf(ok.id)).status).toBe("ACTIVE");
    expect(await prisma.weighing.count()).toBe(weighingsBefore);
  });

  it("valores e total enviados pelo navegador são ignorados (3)", async () => {
    const animal = await createAnimal(t.client);
    const response = await post({
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      total: "1.00",
      items: [{ animalId: animal.id, liveWeightKg: 450, unitPrice: 11, value: "1.00" }],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ total: "4950.00", items: [{ value: "4950.00" }] });
  });

  it("arroba de peso vivo grava o fator; mudar o fator da fazenda não muda a venda antiga (4)", async () => {
    const animal = await createAnimal(t.client);
    const response = await sale([{ animalId: animal.id, liveWeightKg: 450, unitPrice: 300 }], {
      priceUnit: "PER_ARROBA",
      arrobaBasis: "LIVE_FACTOR",
    });
    expect(response.json()).toMatchObject({ arrobaFactorKg: "30.00", total: "4500.00" });

    await t.client.inject({ method: "PATCH", url: "/farm", payload: { arrobaLiveFactorKg: 32 } });
    const again = await t.client.inject({ url: `/trades/${response.json().id}` });
    expect(again.json()).toMatchObject({ arrobaFactorKg: "30.00", total: "4500.00" });

    // negociação nova sem fator usa o da fazenda; com fator, o informado
    const other = await createAnimal(t.client);
    const withFarmFactor = await sale([{ animalId: other.id, liveWeightKg: 450, unitPrice: 300 }], {
      priceUnit: "PER_ARROBA",
      arrobaBasis: "LIVE_FACTOR",
    });
    expect(withFarmFactor.json()).toMatchObject({ arrobaFactorKg: "32.00", total: "4218.75" });
  });

  it("arroba de carcaça = (carcaça ÷ 15) × preço (5)", async () => {
    const animal = await createAnimal(t.client);
    const response = await sale([{ animalId: animal.id, liveWeightKg: 480, carcassWeightKg: 240, unitPrice: 300 }], {
      priceUnit: "PER_ARROBA",
      arrobaBasis: "CARCASS",
    });
    expect(response.json()).toMatchObject({ total: "4800.00", pending: false });
  });

  it("por cabeça sem peso: valor = preço e nenhuma pesagem criada (6)", async () => {
    const animal = await createAnimal(t.client);
    const response = await sale([{ animalId: animal.id, unitPrice: 3000 }], { priceUnit: "PER_HEAD" });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ total: "3000.00", items: [{ hasWeighing: false }] });
    expect(await prisma.weighing.count()).toBe(0);
    expect((await animalOf(animal.id)).status).toBe("SOLD");
  });

  it("carcaça pendente: vendida, 'aguardando romaneio'; ao informar, valor e total aparecem (7)", async () => {
    const animal = await createAnimal(t.client);
    const created = await sale([{ animalId: animal.id, liveWeightKg: 480, unitPrice: 300 }], {
      priceUnit: "PER_ARROBA",
      arrobaBasis: "CARCASS",
    });
    expect(created.json()).toMatchObject({ pending: true, total: null, knownTotal: "0.00" });
    expect((await animalOf(animal.id)).status).toBe("SOLD");
    expect((await t.client.inject({ url: `/animals/${animal.id}/result` })).json().kind).toBe("PENDING");
    const list = (await t.client.inject({ url: "/trades?pending=true" })).json();
    expect(list.items).toHaveLength(1);

    const itemId = created.json().items[0].id;
    const completed = await patch(created.json().id, { items: [{ id: itemId, carcassWeightKg: 240 }] });
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({ pending: false, total: "4800.00" });
    expect((await t.client.inject({ url: "/trades?pending=true" })).json().items).toHaveLength(0);
  });

  it("animal morto não entra na venda (8)", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "DEAD", exitDate: "2026-09-01" },
    });
    const response = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }]);
    expect(response.json().errors[0].code).toBe("DEAD_ANIMAL_CANNOT_BE_SOLD");
  });

  it("animal 'vendido' na mão (sem venda registrada) pode receber a venda; a saída passa a ser a da venda", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "SOLD", exitDate: "2026-09-01" },
    });
    expect((await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }])).statusCode).toBe(201);
    expect((await animalOf(animal.id)).exitDate).toEqual(new Date("2026-10-01"));
  });

  it("venda antes da compra e compra depois da venda → SALE_BEFORE_PURCHASE (9)", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-01-01");
    const before = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }], { date: "2025-12-31" });
    expect(before.json().errors[0]).toMatchObject({ code: "SALE_BEFORE_PURCHASE", params: { date: "2026-01-01" } });

    const other = await createAnimal(t.client);
    await sellAnimal(t.client, other.id, "2026-03-01");
    const lateBuy = await post({
      type: "PURCHASE",
      date: "2026-03-02",
      priceUnit: "PER_KG",
      items: [{ animalId: other.id, liveWeightKg: 200, unitPrice: 10 }],
    });
    expect(lateBuy.json().errors[0]).toMatchObject({ code: "SALE_BEFORE_PURCHASE", params: { date: "2026-03-01" } });
  });

  it("venda antes de uma aplicação já registrada → EXIT_DATE_CONFLICT (10)", async () => {
    const animal = await createAnimal(t.client);
    const product = await t.client.inject({ method: "POST", url: "/products", payload: { name: "V", type: "VACCINE" } });
    await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.json().id, date: "2026-10-12", animalIds: [animal.id] },
    });
    const response = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }], { date: "2026-10-10" });
    expect(response.json().errors[0]).toMatchObject({
      code: "EXIT_DATE_CONFLICT",
      params: { kind: "APPLICATION", date: "2026-10-12" },
    });
  });

  it("centavos: arredonda por item e o total é a soma exata (16)", async () => {
    const items: Item[] = [];
    for (let i = 0; i < 3; i++) {
      const animal = await createAnimal(t.client);
      items.push({ animalId: animal.id, liveWeightKg: 333.33, unitPrice: 10.01 });
    }
    const response = await sale(items);
    expect(response.json().items.map((item: { value: string }) => item.value)).toEqual([
      "3336.63",
      "3336.63",
      "3336.63",
    ]);
    expect(response.json().total).toBe("10009.89");
  });
});

describe("pesagens criadas pela negociação (D-08, D-37)", () => {
  it("pesagem manual no mesmo dia é substituída pela da negociação, com aviso", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-10-01", 390);
    const response = await sale([{ animalId: animal.id, liveWeightKg: 401.5, unitPrice: 10 }]);
    expect(response.json().replacedWeighings).toBe(1);
    const weighings = await prisma.weighing.findMany({ where: { animalId: animal.id } });
    expect(weighings).toHaveLength(1);
    expect(weighings[0]).toMatchObject({ source: "SALE" });
    expect(Number(weighings[0].weightKg)).toBe(401.5);
  });

  it("compra e venda no mesmo dia: só a compra cria a pesagem (uma por dia)", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-10-01");
    const response = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }]);
    expect(response.statusCode).toBe(201);
    expect(response.json().items[0].hasWeighing).toBe(false);
    expect(await prisma.weighing.count({ where: { animalId: animal.id } })).toBe(1);
  });

  it("a compra cria pesagem de origem compra e não muda a situação do animal", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-02-01", 210);
    const weighing = await prisma.weighing.findFirstOrThrow({ where: { animalId: animal.id } });
    expect(weighing.source).toBe("PURCHASE");
    expect((await animalOf(animal.id)).status).toBe("ACTIVE");
  });
});

describe("compra", () => {
  it("segunda compra do mesmo animal → ANIMAL_ALREADY_PURCHASED", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-01-01");
    const again = await post({
      type: "PURCHASE",
      date: "2026-01-02",
      priceUnit: "PER_KG",
      items: [{ animalId: animal.id, liveWeightKg: 200, unitPrice: 10 }],
    });
    expect(again.json().errors[0]).toMatchObject({ code: "ANIMAL_ALREADY_PURCHASED", params: { date: "2026-01-01" } });
  });

  it("compra depois da morte ou antes do nascimento → TRADE_DATE_OUT_OF_RANGE", async () => {
    const dead = await createAnimal(t.client);
    await t.client.inject({
      method: "PATCH",
      url: `/animals/${dead.id}/status`,
      payload: { status: "DEAD", exitDate: "2026-05-01" },
    });
    const born = await createAnimal(t.client, { birthDate: "2026-04-10", birthPrecision: "DAY_MONTH_YEAR" });
    const response = await post({
      type: "PURCHASE",
      date: "2026-05-02",
      priceUnit: "PER_KG",
      items: [
        { animalId: dead.id, liveWeightKg: 200, unitPrice: 10 },
        { animalId: born.id, liveWeightKg: 200, unitPrice: 10 },
      ],
    });
    expect(response.json().errors).toEqual([
      expect.objectContaining({ code: "TRADE_DATE_OUT_OF_RANGE", params: expect.objectContaining({ reason: "AFTER_EXIT" }) }),
    ]);
    const beforeBirth = await post({
      type: "PURCHASE",
      date: "2026-04-09",
      priceUnit: "PER_KG",
      items: [{ animalId: born.id, liveWeightKg: 200, unitPrice: 10 }],
    });
    expect(beforeBirth.json().errors[0].params).toMatchObject({ reason: "BEFORE_BIRTH", date: "2026-04-10" });
  });
});

describe("compra em lote que cadastra os animais (D-36, RN-NEG-015)", () => {
  const newAnimal = (tag: string, extra: Record<string, unknown> = {}) => ({
    newAnimal: { tag, sex: "FEMALE", category: "COW", breed: "Nelore", ...extra },
    liveWeightKg: 400,
    unitPrice: 17,
  });
  const purchase = (items: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
    post({ type: "PURCHASE", date: "2026-10-01", priceUnit: "PER_KG", items, ...extra });

  it("10 linhas, uma com brinco que já existe: nada gravado; corrigida, cria os 10 + a compra (11)", async () => {
    await createAnimal(t.client, { tag: "NOVA-05" });
    const rows = Array.from({ length: 10 }, (_, i) => newAnimal(`NOVA-${String(i + 1).padStart(2, "0")}`));

    const refused = await purchase(rows);
    expect(refused.statusCode).toBe(422);
    expect(refused.json().code).toBe("TRADE_ITEM_ERRORS");
    expect(refused.json().errors).toEqual([
      expect.objectContaining({
        field: "items.4.newAnimal.tag",
        code: "DUPLICATE_TAG",
        params: { tag: "NOVA-05", reason: "IN_FARM" },
      }),
    ]);
    expect(await prisma.animal.count()).toBe(1);
    expect(await prisma.trade.count()).toBe(0);

    rows[4] = newAnimal("NOVA-55");
    const created = await purchase(rows);
    expect(created.statusCode).toBe(201);
    const trade = created.json();
    expect(trade.animalCount).toBe(10);
    expect(trade.total).toBe("68000.00");
    const animals = await prisma.animal.findMany({ where: { tag: { startsWith: "NOVA-" } } });
    expect(animals).toHaveLength(11);
    const bought = animals.find((a) => a.tag === "NOVA-55")!;
    expect(bought).toMatchObject({ sex: "FEMALE", category: "COW", breed: "Nelore", status: "ACTIVE", castrated: null });
    // Peso vivo vira a pesagem da compra (D-08)
    const weighings = await prisma.weighing.findMany({ where: { animalId: bought.id } });
    expect(weighings.map((w) => [w.weightKg.toFixed(2), w.source])).toEqual([["400.00", "PURCHASE"]]);
  });

  it("brinco repetido na própria lista, categoria que não combina, castrado em fêmea: erro na linha certa", async () => {
    const response = await purchase([
      newAnimal("DUP-1"),
      newAnimal("DUP-1"),
      newAnimal("ERR-1", { sex: "MALE", category: "COW" }),
      newAnimal("ERR-2", { castrated: true }),
    ]);
    expect(response.statusCode).toBe(422);
    expect(response.json().errors).toEqual([
      expect.objectContaining({ field: "items.0.newAnimal.tag", code: "DUPLICATE_TAG", params: { tag: "DUP-1", reason: "IN_LIST" } }),
      expect.objectContaining({ field: "items.1.newAnimal.tag", code: "DUPLICATE_TAG" }),
      expect.objectContaining({ field: "items.2.newAnimal.category", code: "CATEGORY_INCOMPATIBLE_WITH_SEX" }),
      expect.objectContaining({ field: "items.3.newAnimal.castrated", code: "CASTRATED_ONLY_FOR_MALES" }),
    ]);
    expect(await prisma.animal.count()).toBe(0);
  });

  it("macho novo sem 'castrado' recebe o padrão da fazenda; mistura animais novos e já cadastrados", async () => {
    await t.client.inject({ method: "PATCH", url: "/farm", payload: { defaultCastrated: true } });
    const existing = await createAnimal(t.client);
    const response = await purchase([
      { animalId: existing.id, liveWeightKg: 300, unitPrice: 10 },
      newAnimal("BOI-1", { sex: "MALE", category: "ADULT_MALE", breed: undefined }),
    ]);
    expect(response.statusCode).toBe(201);
    expect(response.json().animalCount).toBe(2);
    const boi = await prisma.animal.findFirstOrThrow({ where: { tag: "BOI-1" } });
    expect(boi).toMatchObject({ castrated: true, breed: null });
  });

  it("animal novo não entra numa venda; sem animal nenhum na linha → REQUIRED", async () => {
    const inSale = await post({
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      items: [newAnimal("X-1")],
    });
    expect(inSale.statusCode).toBe(422);
    expect(inSale.json().errors[0]).toMatchObject({
      field: "items.0.newAnimal",
      code: "NOT_ALLOWED",
      params: { reason: "NEW_ANIMAL_IN_SALE" },
    });
    const empty = await purchase([{ liveWeightKg: 300, unitPrice: 10 }]);
    expect(empty.statusCode).toBe(400);
    expect(empty.json().errors[0]).toMatchObject({ field: "items.0.animalId", code: "REQUIRED" });
    expect(await prisma.animal.count()).toBe(0);
  });

  it("o mesmo brinco em OUTRA fazenda não impede; o animal novo fica nesta fazenda", async () => {
    const other = await createLoggedClient(t.app, "Fazenda Vizinha");
    await createAnimal(other, { tag: "VIZ-1" });
    const response = await purchase([newAnimal("VIZ-1")]);
    expect(response.statusCode).toBe(201);
    const mine = await prisma.animal.findMany({ where: { tag: "VIZ-1" }, select: { farmId: true } });
    expect(new Set(mine.map((a) => a.farmId)).size).toBe(2);
    const list = await other.inject({ url: "/animals" });
    expect(list.json().filter((a: { tag: string }) => a.tag === "VIZ-1")).toHaveLength(1);
  });

  it("desfazer a compra NÃO apaga os animais criados por ela (D-10)", async () => {
    const created = await purchase([newAnimal("FICA-1"), newAnimal("FICA-2")]);
    const undo = await t.client.inject({ method: "DELETE", url: `/trades/${created.json().id}` });
    expect(undo.statusCode).toBe(204);
    expect(await prisma.animal.count({ where: { tag: { startsWith: "FICA-" } } })).toBe(2);
    expect(await prisma.weighing.count()).toBe(0); // a pesagem da compra sai junto
  });

  it("envio repetido da mesma compra em lote não cria os animais duas vezes (14)", async () => {
    const payload = {
      type: "PURCHASE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      idempotencyKey: randomUUID(),
      items: [newAnimal("REP-1"), newAnimal("REP-2")],
    };
    const responses = await Promise.all([post(payload), post(payload)]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    const again = await post(payload);
    expect(again.statusCode).toBe(200);
    expect(await prisma.animal.count({ where: { tag: { startsWith: "REP-" } } })).toBe(2);
    expect(await prisma.trade.count()).toBe(1);
  });
});

describe("validação da forma de preço", () => {
  it("arroba sem base, carcaça fora da arroba de carcaça, sem peso vivo, carcaça acima do vivo → 400 por campo", async () => {
    const animal = await createAnimal(t.client);
    const noBasis = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }], { priceUnit: "PER_ARROBA" });
    expect(noBasis.json().errors).toEqual([expect.objectContaining({ field: "arrobaBasis", code: "REQUIRED" })]);

    const basisOnKg = await sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }], { arrobaBasis: "CARCASS" });
    expect(basisOnKg.json().errors[0]).toMatchObject({ field: "arrobaBasis", code: "NOT_ALLOWED" });

    const carcassOnKg = await sale([{ animalId: animal.id, liveWeightKg: 400, carcassWeightKg: 200, unitPrice: 10 }]);
    expect(carcassOnKg.json().errors[0]).toMatchObject({ field: "items.0.carcassWeightKg", code: "NOT_ALLOWED" });

    const noWeight = await sale([{ animalId: animal.id, unitPrice: 10 }]);
    expect(noWeight.json().errors[0]).toMatchObject({ field: "items.0.liveWeightKg", code: "REQUIRED" });

    const tooHeavy = await sale([{ animalId: animal.id, liveWeightKg: 400, carcassWeightKg: 401, unitPrice: 10 }], {
      priceUnit: "PER_ARROBA",
      arrobaBasis: "CARCASS",
    });
    expect(tooHeavy.json().errors[0]).toMatchObject({ code: "CARCASS_ABOVE_LIVE_WEIGHT" });

    expect(await prisma.trade.count()).toBe(0);
  });

  it("data futura, lista vazia, animal repetido, preço acima do limite → 400", async () => {
    const animal = await createAnimal(t.client);
    const item = { animalId: animal.id, liveWeightKg: 400, unitPrice: 10 };
    expect((await sale([item], { date: daysFromToday(2) })).json().errors[0].code).toBe("FUTURE_DATE");
    expect((await sale([])).json().errors[0].code).toBe("TOO_FEW");
    expect((await sale([item, item])).json().errors[0].code).toBe("DUPLICATE_ITEMS");
    expect((await sale([{ ...item, unitPrice: 1e12 }])).statusCode).toBe(400);
    expect((await sale([{ ...item, animalId: NON_EXISTENT_ID }])).json().errors[0].code).toBe("ANIMAL_NOT_FOUND");
  });

  it("o banco também recusa forma de preço incoerente e preço zero (CHECK)", async () => {
    const trade = await sellAnimal(t.client, (await createAnimal(t.client)).id, "2026-10-01");
    await expect(prisma.trade.update({ where: { id: trade.id }, data: { priceUnit: "PER_ARROBA" } })).rejects.toThrow();
    await expect(
      prisma.tradeItem.update({ where: { id: trade.items[0].id }, data: { unitPrice: 0 } }),
    ).rejects.toThrow();
  });
});

describe("envio repetido e concorrência", () => {
  it("o mesmo identificador enviado duas vezes devolve a mesma negociação (14)", async () => {
    const animal = await createAnimal(t.client);
    const payload = {
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      idempotencyKey: "6f1d1c84-4f5e-4b8a-9c39-1a2b3c4d5e6f",
      items: [{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }],
    };
    const first = await post(payload);
    const second = await post(payload);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(await prisma.trade.count()).toBe(1);
  });

  it("dois toques ao mesmo tempo com o mesmo identificador: uma negociação só (14)", async () => {
    // Repetido várias vezes: a disputa entre os dois envios cai em momentos
    // diferentes (antes da gravação, durante, depois da conferência dos animais)
    for (let round = 0; round < 8; round += 1) {
      const animal = await createAnimal(t.client, { tag: `RACE-${round}` });
      const payload = {
        type: "SALE",
        date: "2026-10-01",
        priceUnit: "PER_KG",
        idempotencyKey: randomUUID(),
        items: [{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }],
      };
      const responses = await Promise.all([post(payload), post(payload)]);
      expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 201]);
      expect(new Set(responses.map((r) => r.json().id)).size).toBe(1);
    }
    expect(await prisma.trade.count()).toBe(8);
  });

  it("duas vendas diferentes do mesmo animal ao mesmo tempo: só uma grava", async () => {
    const animal = await createAnimal(t.client);
    const responses = await Promise.all([
      sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 }]),
      sale([{ animalId: animal.id, liveWeightKg: 400, unitPrice: 11 }]),
    ]);
    expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(await prisma.tradeItem.count()).toBe(1);
  });
});

describe("corrigir, tirar animal, desfazer (F-NEG-05)", () => {
  it("corrigir preço recalcula e marca o ajuste; corrigir data move pesagens e saída", async () => {
    const a1 = await createAnimal(t.client, { tag: "A-1" });
    const a2 = await createAnimal(t.client, { tag: "A-2" });
    const trade = await createTrade(t.client, {
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      items: [
        { animalId: a1.id, liveWeightKg: 400, unitPrice: 10 },
        { animalId: a2.id, liveWeightKg: 500, unitPrice: 10 },
      ],
    });
    const [i1] = trade.items;

    const priced = await patch(trade.id, {
      date: "2026-10-03",
      counterparty: "Frigorífico X",
      items: [{ id: i1.id, unitPrice: 12, priceAdjusted: true }],
    });
    expect(priced.statusCode).toBe(200);
    expect(priced.json()).toMatchObject({
      date: "2026-10-03",
      counterparty: "Frigorífico X",
      total: "9800.00",
      items: [{ unitPrice: "12.00", priceAdjusted: true, value: "4800.00" }, { value: "5000.00" }],
    });
    expect((await animalOf(a1.id)).exitDate).toEqual(new Date("2026-10-03"));
    const dates = await prisma.weighing.findMany({ select: { date: true } });
    expect(dates.every((w) => w.date.toISOString().startsWith("2026-10-03"))).toBe(true);
  });

  it("nova data antes de uma pesagem manual → EXIT_DATE_CONFLICT; a pesagem da própria venda não conta", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2026-09-20", 380);
    const trade = await sellAnimal(t.client, animal.id, "2026-10-01");
    expect((await patch(trade.id, { date: "2026-09-25" })).statusCode).toBe(200);
    const conflict = await patch(trade.id, { date: "2026-09-19" });
    expect(conflict.statusCode).toBe(422);
    expect(conflict.json().errors[0]).toMatchObject({ code: "EXIT_DATE_CONFLICT", params: { kind: "WEIGHING" } });
  });

  it("trocar de arroba de carcaça para kg limpa a carcaça; item de outra negociação é recusado", async () => {
    const animal = await createAnimal(t.client);
    const trade = await createTrade(t.client, {
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_ARROBA",
      arrobaBasis: "CARCASS",
      items: [{ animalId: animal.id, liveWeightKg: 480, carcassWeightKg: 240, unitPrice: 300 }],
    });
    const toKg = await patch(trade.id, { priceUnit: "PER_KG", items: [{ id: trade.items[0].id, unitPrice: 10 }] });
    expect(toKg.json()).toMatchObject({
      priceUnit: "PER_KG",
      arrobaBasis: null,
      items: [{ carcassWeightKg: null, value: "4800.00" }],
    });

    const wrong = await patch(trade.id, { items: [{ id: NON_EXISTENT_ID, unitPrice: 1 }] });
    expect(wrong.json()).toMatchObject({ code: "TRADE_ITEM_ERRORS", errors: [{ code: "TRADE_ITEM_NOT_FOUND" }] });
  });

  it("tirar 1 de 3: volta a ativo, a pesagem some e o total diminui; desfazer: todos voltam (12)", async () => {
    const animals = [await createAnimal(t.client), await createAnimal(t.client), await createAnimal(t.client)];
    const trade = await createTrade(t.client, {
      type: "SALE",
      date: "2026-10-01",
      priceUnit: "PER_KG",
      items: animals.map((animal) => ({ animalId: animal.id, liveWeightKg: 400, unitPrice: 10 })),
    });
    const removed = trade.items[0];

    const remove = await t.client.inject({ method: "DELETE", url: `/trades/${trade.id}/items/${removed.id}` });
    expect(remove.json()).toEqual({ tradeDeleted: false });
    expect(await animalOf(removed.animal.id)).toMatchObject({ status: "ACTIVE", exitDate: null });
    expect(await prisma.weighing.count({ where: { animalId: removed.animal.id } })).toBe(0);
    expect((await t.client.inject({ url: `/trades/${trade.id}` })).json()).toMatchObject({
      animalCount: 2,
      total: "8000.00",
    });

    expect((await t.client.inject({ method: "DELETE", url: `/trades/${trade.id}` })).statusCode).toBe(204);
    const all = await prisma.animal.findMany();
    expect(all.every((a) => a.status === "ACTIVE" && a.exitDate === null)).toBe(true);
    expect(await prisma.weighing.count()).toBe(0);
    expect(await prisma.trade.count()).toBe(0);
    expect((await t.client.inject({ url: `/trades/${trade.id}` })).statusCode).toBe(404);
  });

  it("tirar o último animal apaga a negociação; desfazer a compra não apaga o animal (D-10)", async () => {
    const animal = await createAnimal(t.client);
    const trade = await buyAnimal(t.client, animal.id, "2026-02-01");
    const remove = await t.client.inject({ method: "DELETE", url: `/trades/${trade.id}/items/${trade.items[0].id}` });
    expect(remove.json()).toEqual({ tradeDeleted: true });
    expect(await prisma.trade.count()).toBe(0);
    expect(await prisma.animal.count({ where: { id: animal.id } })).toBe(1);
    expect(await prisma.weighing.count()).toBe(0);
  });

  it("negociação ou item inexistente → 404", async () => {
    expect((await t.client.inject({ url: `/trades/${NON_EXISTENT_ID}` })).json().code).toBe("TRADE_NOT_FOUND");
    expect((await patch(NON_EXISTENT_ID, { notes: "x" })).statusCode).toBe(404);
    expect((await t.client.inject({ method: "DELETE", url: `/trades/${NON_EXISTENT_ID}` })).statusCode).toBe(404);
    const trade = await sellAnimal(t.client, (await createAnimal(t.client)).id, "2026-10-01");
    const item = await t.client.inject({ method: "DELETE", url: `/trades/${trade.id}/items/${NON_EXISTENT_ID}` });
    expect(item.json().code).toBe("TRADE_ITEM_NOT_FOUND");
  });
});

describe("listar, último preço e resultado", () => {
  it("lista paginada, mais recente primeiro, com filtro por tipo", async () => {
    for (const date of ["2026-01-01", "2026-03-01", "2026-02-01"]) {
      await sellAnimal(t.client, (await createAnimal(t.client)).id, date);
    }
    await buyAnimal(t.client, (await createAnimal(t.client)).id, "2026-01-15");

    const page1 = (await t.client.inject({ url: "/trades?type=SALE&pageSize=2" })).json();
    expect(page1).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(page1.items.map((i: { date: string }) => i.date)).toEqual(["2026-03-01", "2026-02-01"]);
    expect(page1.items[0]).toMatchObject({ animalCount: 1, total: "4620.00", pending: false });

    const page2 = (await t.client.inject({ url: "/trades?type=SALE&pageSize=2&page=2" })).json();
    expect(page2.items.map((i: { date: string }) => i.date)).toEqual(["2026-01-01"]);

    const range = (await t.client.inject({ url: "/trades?from=2026-01-10&to=2026-02-10" })).json();
    expect(range.total).toBe(2);
  });

  it("último preço por categoria, sem contar preço ajustado (RN-NEG-020)", async () => {
    const cow = await createAnimal(t.client, { sex: "FEMALE", category: "COW", breed: "Nelore" });
    const cow2 = await createAnimal(t.client, { sex: "FEMALE", category: "COW", breed: "Angus" });
    await createTrade(t.client, {
      type: "SALE",
      date: "2026-09-01",
      priceUnit: "PER_KG",
      items: [
        { animalId: cow.id, liveWeightKg: 400, unitPrice: 17 },
        { animalId: cow2.id, liveWeightKg: 400, unitPrice: 25, priceAdjusted: true },
      ],
    });
    const response = await t.client.inject({ url: "/trades/last-prices?type=SALE&priceUnit=PER_KG" });
    expect(response.json()).toEqual({
      byCategory: [{ group: "COW", unitPrice: "17.00", date: "2026-09-01" }],
      byCategoryAndBreed: [{ group: "COW", breed: "Nelore", unitPrice: "17.00", date: "2026-09-01" }],
    });
    const other = await t.client.inject({ url: "/trades/last-prices?type=SALE&priceUnit=PER_HEAD" });
    expect(other.json().byCategory).toEqual([]);
  });

  it("resultado: compra R$ 2.500 e venda R$ 3.600 → diferença R$ 1.100 (15)", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-01-01", 200, 12.5);
    expect((await t.client.inject({ url: `/animals/${animal.id}/result` })).json()).toMatchObject({
      kind: "INVESTED",
      purchase: { value: "2500.00" },
    });
    await sellAnimal(t.client, animal.id, "2026-09-01", 400, 9);
    const result = (await t.client.inject({ url: `/animals/${animal.id}/result` })).json();
    expect(result).toMatchObject({
      kind: "DIFFERENCE",
      difference: "1100.00",
      purchase: { value: "2500.00", priceUnit: "PER_KG" },
      sale: { value: "3600.00", date: "2026-09-01" },
    });
  });

  it("lista de animais diz quem já tem compra ou venda", async () => {
    const animal = await createAnimal(t.client);
    await buyAnimal(t.client, animal.id, "2026-01-01");
    const [row] = (await t.client.inject({ url: "/animals" })).json();
    expect(row).toMatchObject({ hasPurchase: true, hasSale: false });
  });
});
