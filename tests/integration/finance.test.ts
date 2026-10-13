import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { NON_EXISTENT_ID, addWeighing, createAnimal } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

const t = useTestApp();

const purchase = { date: "2026-01-01", weightKg: 200, pricePerKg: 12.5 };
const sale = { date: "2026-06-01", weightKg: 420, pricePerKg: 11 };

describe("compra", () => {
  it("registra, consulta, edita e exclui", async () => {
    const animal = await createAnimal(t.client);
    const url = `/animals/${animal.id}/purchase`;

    expect((await t.client.inject({ method: "POST", url, payload: purchase })).statusCode).toBe(201);
    expect((await t.client.inject({ url })).json()).toMatchObject({ pricePerKg: "12.5" });

    const edit = await t.client.inject({ method: "PUT", url, payload: { ...purchase, pricePerKg: 13 } });
    expect(edit.statusCode).toBe(200);

    expect((await t.client.inject({ method: "DELETE", url })).statusCode).toBe(204);
    const gone = await t.client.inject({ url });
    expect(gone.statusCode).toBe(404);
    expect(gone.json().code).toBe("PURCHASE_NOT_FOUND");
  });

  it("segunda compra → 409 DUPLICATE_PURCHASE", async () => {
    const animal = await createAnimal(t.client);
    const url = `/animals/${animal.id}/purchase`;
    await t.client.inject({ method: "POST", url, payload: purchase });
    const response = await t.client.inject({ method: "POST", url, payload: purchase });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DUPLICATE_PURCHASE");
  });

  it("preço acima do limite do banco → 400, nunca 500 (F-14)", async () => {
    const animal = await createAnimal(t.client);
    const response = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/purchase`,
      payload: { ...purchase, pricePerKg: 1e12 },
    });
    expect(response.statusCode).toBe(400);
  });

  it("compra de animal inexistente → 404", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: `/animals/${NON_EXISTENT_ID}/purchase`,
      payload: purchase,
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("venda", () => {
  it("registra a venda e marca o animal como SOLD; desfazer volta para ACTIVE", async () => {
    const animal = await createAnimal(t.client);
    const url = `/animals/${animal.id}/sale`;

    expect((await t.client.inject({ method: "POST", url, payload: sale })).statusCode).toBe(201);
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).status).toBe("SOLD");

    expect((await t.client.inject({ method: "DELETE", url })).statusCode).toBe(204);
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).status).toBe("ACTIVE");
  });

  it("animal morto não recebe venda → 409 DEAD_ANIMAL_CANNOT_BE_SOLD", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({ method: "PATCH", url: `/animals/${animal.id}/status`, payload: { status: "DEAD", exitDate: "2026-01-10" } });
    const response = await t.client.inject({ method: "POST", url: `/animals/${animal.id}/sale`, payload: sale });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("DEAD_ANIMAL_CANNOT_BE_SOLD");
    expect(await prisma.animalSale.count()).toBe(0);
  });

  it("venda anterior à compra → 422 SALE_BEFORE_PURCHASE (D-06), nos dois sentidos", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({ method: "POST", url: `/animals/${animal.id}/purchase`, payload: purchase });

    const before = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/sale`,
      payload: { ...sale, date: "2025-12-31" },
    });
    expect(before.statusCode).toBe(422);
    expect(before.json().code).toBe("SALE_BEFORE_PURCHASE");

    // venda válida, depois tentar mover a compra para depois da venda
    await t.client.inject({ method: "POST", url: `/animals/${animal.id}/sale`, payload: sale });
    const movePurchase = await t.client.inject({
      method: "PUT",
      url: `/animals/${animal.id}/purchase`,
      payload: { ...purchase, date: "2026-06-02" },
    });
    expect(movePurchase.statusCode).toBe(422);
  });

  it("duas vendas ao mesmo tempo: só uma é gravada (unicidade no banco)", async () => {
    const animal = await createAnimal(t.client);
    const url = `/animals/${animal.id}/sale`;
    const [r1, r2] = await Promise.all([
      t.client.inject({ method: "POST", url, payload: sale }),
      t.client.inject({ method: "POST", url, payload: sale }),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
    expect(await prisma.animalSale.count()).toBe(1);
  });

  it("desfazer venda que não existe → 404 e o status não muda", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({ method: "PATCH", url: `/animals/${animal.id}/status`, payload: { status: "SOLD", exitDate: "2026-01-10" } });
    const response = await t.client.inject({ method: "DELETE", url: `/animals/${animal.id}/sale` });
    expect(response.statusCode).toBe(404);
    expect((await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } })).status).toBe("SOLD");
  });
});

describe("preço estimado e resultado", () => {
  it("informa, limpa com null e calcula o resultado", async () => {
    const animal = await createAnimal(t.client);
    await t.client.inject({ method: "POST", url: `/animals/${animal.id}/purchase`, payload: purchase });
    await addWeighing(t.client, animal.id, "2026-03-01", 300);

    const set = await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/estimated-price`,
      payload: { pricePerKg: 12 },
    });
    expect(set.statusCode).toBe(200);

    const result = await t.client.inject({ url: `/animals/${animal.id}/result` });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      purchaseCost: 2500,
      estimatedValue: 3600,
      result: 1100,
      resultType: "ESTIMATED",
    });

    const clear = await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/estimated-price`,
      payload: { pricePerKg: null },
    });
    expect(clear.json().estimatedPricePerKg).toBeNull();
  });

  it("resultado de animal inexistente → 404", async () => {
    const response = await t.client.inject({ url: `/animals/${NON_EXISTENT_ID}/result` });
    expect(response.statusCode).toBe(404);
  });
});
