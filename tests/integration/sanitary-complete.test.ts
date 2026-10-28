import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { useTestApp } from "../helpers/suite.js";
import { createAnimal, createProduct, daysFromToday, today } from "../helpers/factories.js";
import { createLoggedClient } from "../helpers/client.js";
import { prisma } from "../../src/lib/prisma.js";

// MANEJO SANITÁRIO COMPLETO (Espec — Manejo sanitário v1.0, 2026-10-18).
// Números = critérios de aceitação da espec (§10).

const t = useTestApp();

const apply = (payload: Record<string, unknown>) =>
  t.client.inject({ method: "POST", url: "/applications", payload });

const alerts = async () =>
  (await t.client.inject({ url: "/alerts" })).json() as {
    id: string;
    activeAnimalsCount: number;
    activeAnimalIds: string[];
    overdue: boolean;
  }[];

describe("produtos (F-18, D-39)", () => {
  it("quatro tipos, para que serve, fabricante e carência", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/products",
      payload: {
        name: "Ivermectina 1%",
        type: "EXTERNAL_PARASITICIDE",
        purpose: "carrapato e berne",
        manufacturer: "Lab X",
        withdrawalDays: 35,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ type: "EXTERNAL_PARASITICIDE", withdrawalDays: 35, usageCount: 0 });
    expect((await createProduct(t.client, { name: "Antibiótico", type: "OTHER" })).name).toBe("Antibiótico");
  });

  it("nome repetido sem diferenciar maiúsculas é recusado (3)", async () => {
    await createProduct(t.client, { name: "Ivermectina" });
    const response = await t.client.inject({ method: "POST", url: "/products", payload: { name: "ivermectina", type: "DEWORMER" } });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DUPLICATE_PRODUCT_NAME");
  });

  it("editar; carência nova não muda aplicação antiga (12)", async () => {
    const product = (
      await t.client.inject({ method: "POST", url: "/products", payload: { name: "Ivomec", type: "DEWORMER", withdrawalDays: 30 } })
    ).json();
    const animal = await createAnimal(t.client);
    const application = (await apply({ productId: product.id, date: "2026-09-10", animalIds: [animal.id] })).json();
    expect(application.withdrawalEndDate).toBe("2026-10-10T00:00:00.000Z");

    const edited = await t.client.inject({ method: "PUT", url: `/products/${product.id}`, payload: { withdrawalDays: 45, purpose: null } });
    expect(edited.json()).toMatchObject({ withdrawalDays: 45, purpose: null, usageCount: 1 });
    const again = (await t.client.inject({ url: `/applications/${application.id}` })).json();
    expect(again).toMatchObject({ withdrawalDays: 30, withdrawalEndDate: "2026-10-10T00:00:00.000Z" });
  });

  it("produto usado não se exclui: arquiva, some da seleção e continua no histórico (4)", async () => {
    const product = await createProduct(t.client, { name: "Aftosa" });
    const animal = await createAnimal(t.client);
    const application = (await apply({ productId: product.id, date: "2026-01-02", animalIds: [animal.id] })).json();

    const deleted = await t.client.inject({ method: "DELETE", url: `/products/${product.id}` });
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json().code).toBe("PRODUCT_IN_USE");

    await t.client.inject({ method: "PATCH", url: `/products/${product.id}/archive` });
    expect((await t.client.inject({ url: "/products" })).json()).toHaveLength(0);
    const all = (await t.client.inject({ url: "/products?includeArchived=true" })).json();
    expect(all[0].archivedAt).not.toBeNull();
    expect((await t.client.inject({ url: `/applications/${application.id}` })).json().product.name).toBe("Aftosa");

    const blocked = await apply({ productId: product.id, date: "2026-01-03", animalIds: [animal.id] });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe("PRODUCT_ARCHIVED");

    await t.client.inject({ method: "PATCH", url: `/products/${product.id}/unarchive` });
    expect((await t.client.inject({ url: "/products" })).json()).toHaveLength(1);
    const audit = await prisma.auditLog.findMany({ where: { farmId: t.client.farm.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((log) => log.action)).toEqual(["PRODUCT_ARCHIVED", "PRODUCT_RESTORED"]);
  });

  it("produto nunca usado pode ser excluído", async () => {
    const product = await createProduct(t.client);
    expect((await t.client.inject({ method: "DELETE", url: `/products/${product.id}` })).statusCode).toBe(204);
  });

  it("carência fora do intervalo é recusada; vazio = não informada", async () => {
    const bad = await t.client.inject({ method: "POST", url: "/products", payload: { name: "X", type: "OTHER", withdrawalDays: 400 } });
    expect(bad.statusCode).toBe(400);
    const none = (await t.client.inject({ method: "POST", url: "/products", payload: { name: "Y", type: "OTHER" } })).json();
    expect(none.withdrawalDays).toBeNull();
  });
});

describe("aplicação: dose, partida, animais e envio repetido", () => {
  it("dose e partida são só registro; quantidade sem unidade é recusada", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const ok = await apply({ productId: product.id, date: "2026-01-02", animalIds: [animal.id], doseAmount: 2.5, doseUnit: "ML", batchNumber: "P-123" });
    expect(ok.json()).toMatchObject({ doseAmount: "2.5", doseUnit: "ML", batchNumber: "P-123" });
    const bad = await apply({ productId: product.id, date: "2026-01-03", animalIds: [animal.id], doseAmount: 2 });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errors[0].code).toBe("DOSE_INCOMPLETE");
  });

  it("corrigir os animais: tira quem não recebeu e inclui quem faltou", async () => {
    const product = await createProduct(t.client);
    const [a, b, c] = [await createAnimal(t.client), await createAnimal(t.client), await createAnimal(t.client)];
    const application = (await apply({ productId: product.id, date: "2026-01-02", animalIds: [a.id, b.id] })).json();
    const edited = await t.client.inject({
      method: "PUT",
      url: `/applications/${application.id}`,
      payload: { productId: product.id, date: "2026-01-02", animalIds: [b.id, c.id] },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().animals.map((link: { animalId: string }) => link.animalId).sort()).toEqual([b.id, c.id].sort());
  });

  it("animal que saiu não entra na correção (2)", async () => {
    const product = await createProduct(t.client);
    const alive = await createAnimal(t.client);
    const dead = await createAnimal(t.client, { tag: "MORTO-1" });
    await t.client.inject({ method: "PATCH", url: `/animals/${dead.id}/status`, payload: { status: "DEAD", exitDate: "2026-01-01" } });
    const application = (await apply({ productId: product.id, date: "2026-01-02", animalIds: [alive.id] })).json();
    const edited = await t.client.inject({
      method: "PUT",
      url: `/applications/${application.id}`,
      payload: { productId: product.id, date: "2026-01-02", animalIds: [alive.id, dead.id] },
    });
    expect(edited.statusCode).toBe(422);
    expect(edited.json().errors[0].params.tags).toBe("MORTO-1");
  });

  it("mesmo identificador de operação → a mesma aplicação, nunca duas", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const payload = { productId: product.id, date: "2026-01-02", animalIds: [animal.id], idempotencyKey: randomUUID() };
    const [first, second] = await Promise.all([apply(payload), apply(payload)]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([200, 201]);
    expect(first.json().id).toBe(second.json().id);
    expect(await prisma.application.count({ where: { farmId: t.client.farm.id } })).toBe(1);
  });
});

describe("lembretes (D-40, RN-SAN-006/007/008)", () => {
  async function scenario() {
    const product = await createProduct(t.client);
    const animals = [await createAnimal(t.client), await createAnimal(t.client), await createAnimal(t.client)];
    const application = (
      await apply({ productId: product.id, date: daysFromToday(-30), reapplyDate: daysFromToday(-1), animalIds: animals.map((a) => a.id) })
    ).json();
    return { product, animals, application };
  }

  it("conta só os animais ativos e lista os ids para reaplicar (9)", async () => {
    const { animals } = await scenario();
    await t.client.inject({ method: "PATCH", url: `/animals/${animals[0].id}/status`, payload: { status: "SOLD", exitDate: today() } });
    const [reminder] = await alerts();
    expect(reminder).toMatchObject({ overdue: true, activeAnimalsCount: 2 });
    expect(reminder.activeAnimalIds.sort()).toEqual([animals[1].id, animals[2].id].sort());
  });

  it("vencido há muito tempo continua na lista (8)", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    await apply({ productId: product.id, date: daysFromToday(-200), reapplyDate: daysFromToday(-90), animalIds: [animal.id] });
    expect(await alerts()).toHaveLength(1);
  });

  it("sai ao registrar a reaplicação a partir dele (7a)", async () => {
    const { product, animals, application } = await scenario();
    const reapplied = await apply({
      productId: product.id,
      date: today(),
      animalIds: animals.map((a) => a.id),
      reappliesApplicationId: application.id,
    });
    expect(reapplied.statusCode).toBe(201);
    expect(await alerts()).toHaveLength(0);
    const source = (await t.client.inject({ url: `/applications/${application.id}` })).json();
    expect(source.reappliedBy).toHaveLength(1);
  });

  it("sai ao dispensar, guardando o motivo (7b)", async () => {
    const { application } = await scenario();
    const dismissed = await t.client.inject({
      method: "POST",
      url: `/applications/${application.id}/dismiss-reminder`,
      payload: { reason: "lançado errado" },
    });
    expect(dismissed.json()).toMatchObject({ reminderDismissReason: "lançado errado" });
    expect(dismissed.json().reminderDismissedAt).not.toBeNull();
    expect(await alerts()).toHaveLength(0);
  });

  it("sai sozinho quando nenhum animal do grupo continua ativo (7c)", async () => {
    const { animals } = await scenario();
    for (const animal of animals) {
      await t.client.inject({ method: "PATCH", url: `/animals/${animal.id}/status`, payload: { status: "DEAD", exitDate: today() } });
    }
    expect(await alerts()).toHaveLength(0);
  });

  it("dispensar aplicação sem reaplicação marcada → NO_REMINDER", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const application = (await apply({ productId: product.id, date: "2026-01-02", animalIds: [animal.id] })).json();
    const response = await t.client.inject({ method: "POST", url: `/applications/${application.id}/dismiss-reminder`, payload: {} });
    expect(response.json().code).toBe("NO_REMINDER");
  });

  it("lembrete de outra fazenda não serve de origem", async () => {
    const other = await createLoggedClient(t.app, "Outra");
    const otherProduct = await createProduct(other);
    const otherAnimal = await createAnimal(other);
    const otherApplication = (
      await other.inject({
        method: "POST",
        url: "/applications",
        payload: { productId: otherProduct.id, date: "2026-01-02", reapplyDate: "2026-02-02", animalIds: [otherAnimal.id] },
      })
    ).json();
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const response = await apply({ productId: product.id, date: "2026-02-02", animalIds: [animal.id], reappliesApplicationId: otherApplication.id });
    expect(response.json().code).toBe("REAPPLY_SOURCE_INVALID");
    const dismiss = await t.client.inject({ method: "POST", url: `/applications/${otherApplication.id}/dismiss-reminder`, payload: {} });
    expect(dismiss.statusCode).toBe(404);
  });
});

describe("carência na venda (D-12, RN-SAN-010)", () => {
  async function inWithdrawal(withdrawalDays: number | undefined) {
    const product = (
      await t.client.inject({ method: "POST", url: "/products", payload: { name: `Ivermectina ${withdrawalDays}`, type: "DEWORMER", withdrawalDays } })
    ).json();
    const animal = await createAnimal(t.client, { tag: "BR-104" });
    await apply({ productId: product.id, date: "2026-09-10", animalIds: [animal.id] });
    return animal;
  }
  const sale = (animalId: string, extra: Record<string, unknown> = {}) =>
    t.client.inject({
      method: "POST",
      url: "/trades",
      payload: { type: "SALE", date: "2026-10-01", priceUnit: "PER_KG", items: [{ animalId, liveWeightKg: 400, unitPrice: 10 }], ...extra },
    });

  it("avisa com animal, produto e data; com o aceite, grava e guarda (10)", async () => {
    const animal = await inWithdrawal(30);
    const warned = await sale(animal.id);
    expect(warned.statusCode).toBe(409);
    expect(warned.json()).toMatchObject({ code: "WITHDRAWAL_WARNING" });
    expect(warned.json().errors[0]).toMatchObject({
      field: "items.0.animalId",
      params: { tag: "BR-104", until: "2026-10-10", product: "Ivermectina 30", appliedOn: "2026-09-10" },
    });
    expect(await prisma.trade.count({ where: { farmId: t.client.farm.id } })).toBe(0);

    const accepted = await sale(animal.id, { acknowledgeWithdrawal: true });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().withdrawalWarningAccepted).toBe(true);
  });

  it("sem carência informada, nenhum aviso (11)", async () => {
    const animal = await inWithdrawal(undefined);
    const response = await sale(animal.id);
    expect(response.statusCode).toBe(201);
    expect(response.json().withdrawalWarningAccepted).toBe(false);
  });

  it("a ficha mostra se o animal está em carência hoje", async () => {
    const product = (await t.client.inject({ method: "POST", url: "/products", payload: { name: "P", type: "OTHER", withdrawalDays: 10 } })).json();
    const animal = await createAnimal(t.client);
    await apply({ productId: product.id, date: today(), animalIds: [animal.id] });
    const [application] = (await t.client.inject({ url: `/animals/${animal.id}/applications` })).json();
    expect(application.inWithdrawal).toBe(true);
  });
});

describe("isolamento (13)", () => {
  it("produto da outra fazenda: 404 em editar, arquivar e excluir; nada muda", async () => {
    const other = await createLoggedClient(t.app, "Outra");
    const product = await createProduct(other, { name: "Deles" });
    for (const [method, url, payload] of [
      ["PUT", `/products/${product.id}`, { name: "Invadido" }],
      ["PATCH", `/products/${product.id}/archive`, undefined],
      ["PATCH", `/products/${product.id}/unarchive`, undefined],
      ["DELETE", `/products/${product.id}`, undefined],
    ] as const) {
      const response = await t.client.inject({ method, url, payload });
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after).toMatchObject({ name: "Deles", archivedAt: null });
  });
});

describe("lista e resumo do manejo (tela Manejo sanitário)", () => {
  it("busca por produto ou brinco, período e quem registrou", async () => {
    const vaccine = await createProduct(t.client, { name: "Vacina Aftosa" });
    const wormer = await createProduct(t.client, { name: "Ivomec", type: "DEWORMER" });
    const a = await createAnimal(t.client, { tag: "BUSCA-1" });
    const b = await createAnimal(t.client, { tag: "OUTRO-2" });
    await apply({ productId: vaccine.id, date: daysFromToday(-40), animalIds: [a.id] });
    await apply({ productId: wormer.id, date: daysFromToday(-2), animalIds: [b.id] });

    const list = async (query: string) =>
      ((await t.client.inject({ url: `/applications?${query}` })).json() as { product: { name: string } }[]).map(
        (item) => item.product.name,
      );
    expect(await list("q=aftosa")).toEqual(["Vacina Aftosa"]);
    expect(await list("q=busca")).toEqual(["Vacina Aftosa"]); // brinco do animal
    expect(await list(`from=${daysFromToday(-10)}`)).toEqual(["Ivomec"]);

    const [first] = (await t.client.inject({ url: "/applications" })).json();
    expect(first.createdBy).toEqual({ id: expect.any(String), name: expect.any(String) });
    expect(first.createdBy).not.toHaveProperty("email");
  });

  it("resumo: aplicações e animais diferentes no período, ativos, lembretes e produtos", async () => {
    const product = await createProduct(t.client);
    await createProduct(t.client, { name: "Arquivado" }).then((p) =>
      t.client.inject({ method: "PATCH", url: `/products/${p.id}/archive` }),
    );
    const [a, b] = [await createAnimal(t.client), await createAnimal(t.client)];
    await apply({ productId: product.id, date: daysFromToday(-3), animalIds: [a.id, b.id], reapplyDate: daysFromToday(2) });
    await apply({ productId: product.id, date: daysFromToday(-1), animalIds: [a.id] });
    await apply({ productId: product.id, date: daysFromToday(-60), animalIds: [b.id] });

    const summary = (await t.client.inject({ url: `/applications/summary?from=${daysFromToday(-30)}&to=${today()}` })).json();
    expect(summary).toEqual({
      applications: 2,
      animalsTreated: 2,
      activeAnimals: 2,
      reminders: { open: 1, overdue: 0, alertDays: 7 },
      products: 1,
    });
    const all = (await t.client.inject({ url: "/applications/summary" })).json();
    expect(all.applications).toBe(3);
  });
});
