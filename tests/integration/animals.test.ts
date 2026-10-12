import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import {
  NON_EXISTENT_ID,
  addWeighing,
  createAnimal,
  daysFromToday,
  today,
} from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

const t = useTestApp();

describe("POST /animals", () => {
  it("cadastra um animal e devolve 201", async () => {
    const response = await t.app.inject({
      method: "POST",
      url: "/animals",
      payload: {
        tag: "BR-001",
        sex: "FEMALE",
        category: "COW",
        breed: "Nelore",
        birthDate: "2022-03-15",
        birthPrecision: "DAY_MONTH_YEAR",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      tag: "BR-001",
      status: "ACTIVE",
      birthDate: "2022-03-15T00:00:00.000Z",
    });
  });

  it("remove espaços das pontas do brinco (F-13)", async () => {
    const animal = await createAnimal(t.app, { tag: "  BR-010  " });
    expect(animal.tag).toBe("BR-010");
  });

  it("brinco repetido → 409 DUPLICATE_TAG, inclusive com espaços (F-12, F-13)", async () => {
    await createAnimal(t.app, { tag: "BR-020" });
    const response = await t.app.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: " BR-020 ", sex: "MALE", category: "CALF" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "DUPLICATE_TAG" });
  });

  it.each([
    ["brinco vazio", { tag: "   " }],
    ["brinco longo demais", { tag: "x".repeat(51) }],
    ["sexo inválido", { sex: "X" }],
    ["categoria inválida", { category: "HORSE" }],
    ["nascimento no futuro", { birthDate: daysFromToday(1) }],
    ["data mal formatada", { birthDate: "15/03/2022" }],
    ["observação longa demais", { notes: "x".repeat(1001) }],
    ["campo desconhecido", { farmId: NON_EXISTENT_ID }],
  ])("recusa %s com 400 VALIDATION_ERROR", async (_label, override) => {
    const response = await t.app.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "BR-030", sex: "MALE", category: "CALF", ...override },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("aceita nascimento hoje (fuso da fazenda)", async () => {
    const animal = await createAnimal(t.app, { birthDate: today() });
    expect(animal.id).toBeTruthy();
  });
});

describe("GET /animals e GET /animals/:id", () => {
  it("lista com filtro e devolve o peso da última pesagem", async () => {
    const a = await createAnimal(t.app, { tag: "A-1", category: "COW", sex: "FEMALE" });
    await createAnimal(t.app, { tag: "A-2", category: "CALF" });
    await addWeighing(t.app, a.id, "2026-01-01", 400);
    await addWeighing(t.app, a.id, "2026-02-01", 420.5);

    const response = await t.app.inject({ url: "/animals?category=COW" });
    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ tag: "A-1", currentWeightKg: 420.5 });
  });

  it("filtro inválido → 400", async () => {
    const response = await t.app.inject({ url: "/animals?status=LOST" });
    expect(response.statusCode).toBe(400);
  });

  it("id que não existe → 404 ANIMAL_NOT_FOUND", async () => {
    const response = await t.app.inject({ url: `/animals/${NON_EXISTENT_ID}` });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("ANIMAL_NOT_FOUND");
  });

  it("id que não é UUID → 400 (manipulação de ID)", async () => {
    for (const id of ["123", "abc", "1%20OR%201=1", "%27%3B%20DROP%20TABLE%20Animal"]) {
      const response = await t.app.inject({ url: `/animals/${id}` });
      expect([400, 404]).toContain(response.statusCode);
      expect(response.statusCode).not.toBe(500);
    }
  });
});

describe("PUT /animals/:id", () => {
  it("edita e LIMPA raça, nascimento e observações com null (F-11)", async () => {
    const animal = await createAnimal(t.app, {
      breed: "Gir",
      notes: "obs",
      birthDate: "2023-01-01",
      birthPrecision: "DAY_MONTH_YEAR",
    });

    const response = await t.app.inject({
      method: "PUT",
      url: `/animals/${animal.id}`,
      payload: { breed: null, notes: null, birthDate: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      breed: null,
      notes: null,
      birthDate: null,
      birthPrecision: "UNKNOWN",
    });
  });

  it("não permite trocar o brinco por aqui (campo recusado)", async () => {
    const animal = await createAnimal(t.app);
    const response = await t.app.inject({
      method: "PUT",
      url: `/animals/${animal.id}`,
      payload: { tag: "OUTRO" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("animal inexistente → 404", async () => {
    const response = await t.app.inject({
      method: "PUT",
      url: `/animals/${NON_EXISTENT_ID}`,
      payload: { breed: "Nelore" },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("DELETE /animals/:id", () => {
  it("exclui o animal e as pesagens dele, num passo só (F-22)", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, "2026-01-01", 200);

    const response = await t.app.inject({ method: "DELETE", url: `/animals/${animal.id}` });
    expect(response.statusCode).toBe(204);
    expect(await prisma.weighing.count({ where: { animalId: animal.id } })).toBe(0);
  });

  it("NÃO exclui animal com compra registrada (D-10)", async () => {
    const animal = await createAnimal(t.app);
    await t.app.inject({
      method: "POST",
      url: `/animals/${animal.id}/purchase`,
      payload: { date: "2026-01-01", weightKg: 200, pricePerKg: 12 },
    });

    const response = await t.app.inject({ method: "DELETE", url: `/animals/${animal.id}` });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("ANIMAL_HAS_TRANSACTIONS");
    expect(await prisma.animalPurchase.count()).toBe(1);
  });

  it("NÃO exclui animal com venda registrada (D-10)", async () => {
    const animal = await createAnimal(t.app);
    await t.app.inject({
      method: "POST",
      url: `/animals/${animal.id}/sale`,
      payload: { date: "2026-01-01", weightKg: 450, pricePerKg: 11 },
    });

    const response = await t.app.inject({ method: "DELETE", url: `/animals/${animal.id}` });
    expect(response.statusCode).toBe(409);
    expect(await prisma.animalSale.count()).toBe(1);
  });

  it("animal inexistente → 404", async () => {
    const response = await t.app.inject({ method: "DELETE", url: `/animals/${NON_EXISTENT_ID}` });
    expect(response.statusCode).toBe(404);
  });
});

describe("PATCH /animals/:id/status", () => {
  it("muda o status de um animal sem venda", async () => {
    const animal = await createAnimal(t.app);
    const response = await t.app.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "DEAD" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("DEAD");
  });

  it("animal com venda não volta a ativo nem vira morto pelo status (D-06, F-08)", async () => {
    const animal = await createAnimal(t.app);
    await t.app.inject({
      method: "POST",
      url: `/animals/${animal.id}/sale`,
      payload: { date: "2026-01-01", weightKg: 450, pricePerKg: 11 },
    });

    for (const status of ["ACTIVE", "DEAD"]) {
      const response = await t.app.inject({
        method: "PATCH",
        url: `/animals/${animal.id}/status`,
        payload: { status },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe("ANIMAL_HAS_SALE");
    }
  });

  it("status inválido → 400", async () => {
    const animal = await createAnimal(t.app);
    const response = await t.app.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "STOLEN" },
    });
    expect(response.statusCode).toBe(400);
  });
});
