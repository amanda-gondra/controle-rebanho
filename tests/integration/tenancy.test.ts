import { beforeEach, describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { type Client, createLoggedClient } from "../helpers/client.js";
import { addWeighing, buyAnimal, createAnimal, createProduct, sellAnimal } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

// ISOLAMENTO ENTRE FAZENDAS (G1, critério de aceitação 3).
// Duas fazendas, A e B, cada uma com seu usuário. Logado em A, tudo que é de B
// tem que se comportar como se não existisse (404) — ler, editar, excluir —,
// em todas as rotas, inclusive as aninhadas. E nada de B pode mudar.

const t = useTestApp();

let farmA: Client;
let farmB: Client;
let b: {
  animalId: string;
  weighingId: string;
  productId: string;
  applicationId: string;
  soldAnimalId: string;
  tradeId: string;
  tradeItemId: string;
};

beforeEach(async () => {
  farmA = t.client;
  farmB = await createLoggedClient(t.app, "Fazenda B");

  // Dados da fazenda B
  const animal = await createAnimal(farmB, { tag: "B-001" });
  const weighing = await addWeighing(farmB, animal.id, "2026-01-01", 300);
  const product = await createProduct(farmB, { name: "Vacina B" });
  const application = await farmB.inject({
    method: "POST",
    url: "/applications",
    payload: { productId: product.id, date: "2026-01-05", reapplyDate: "2099-01-01", animalIds: [animal.id] },
  });
  await buyAnimal(farmB, animal.id, "2025-12-01", 250, 12);
  const sold = await createAnimal(farmB, { tag: "B-002" });
  const sale = await sellAnimal(farmB, sold.id, "2026-01-10", 400, 11);

  b = {
    animalId: animal.id,
    weighingId: weighing.id,
    productId: product.id,
    applicationId: application.json().id,
    soldAnimalId: sold.id,
    tradeId: sale.id,
    tradeItemId: sale.items[0].id,
  };
});

// Fotografia de tudo que a fazenda B tem — para provar que nada mudou
async function snapshotFarmB() {
  const where = { farmId: farmB.farm.id };
  return JSON.stringify(
    await Promise.all([
      prisma.animal.findMany({ where, orderBy: { id: "asc" } }),
      prisma.weighing.findMany({ where, orderBy: { id: "asc" } }),
      prisma.product.findMany({ where, orderBy: { id: "asc" } }),
      prisma.application.findMany({ where, orderBy: { id: "asc" } }),
      prisma.applicationAnimal.findMany({ where, orderBy: { id: "asc" } }),
      prisma.trade.findMany({ where, orderBy: { id: "asc" } }),
      prisma.tradeItem.findMany({ where, orderBy: { id: "asc" } }),
      prisma.farm.findUnique({ where: { id: farmB.farm.id } }),
    ]),
  );
}

describe("isolamento entre fazendas", () => {
  it("listas da fazenda A não mostram nada da fazenda B", async () => {
    await createAnimal(farmA, { tag: "A-001" });
    for (const url of ["/animals", "/products", "/applications", "/alerts", "/trades"]) {
      const response = await farmA.inject({ url });
      expect(response.statusCode, url).toBe(200);
      expect(JSON.stringify(response.json()), url).not.toMatch(/B-00|Vacina B/);
    }
    const animals = (await farmA.inject({ url: "/animals" })).json();
    expect(animals.map((a: { tag: string }) => a.tag)).toEqual(["A-001"]);
  });

  it("a fazenda B continua vendo os próprios dados", async () => {
    const animals = (await farmB.inject({ url: "/animals" })).json();
    expect(animals).toHaveLength(2);
  });

  it("toda rota com id da fazenda B responde 404 para a fazenda A, e nada de B muda", async () => {
    const before = await snapshotFarmB();
    const { animalId, weighingId, productId, applicationId, tradeId, tradeItemId } = b;

    const attempts: [string, string, unknown?][] = [
      ["GET", `/animals/${animalId}`],
      ["PUT", `/animals/${animalId}`, { breed: "Invadida" }],
      ["PATCH", `/animals/${animalId}/status`, { status: "DEAD" }],
      ["DELETE", `/animals/${animalId}`],
      ["GET", `/animals/${animalId}/weighings`],
      ["POST", `/animals/${animalId}/weighings`, { date: "2026-01-02", weightKg: 999 }],
      ["PUT", `/animals/${animalId}/weighings/${weighingId}`, { date: "2026-01-02", weightKg: 999 }],
      ["DELETE", `/animals/${animalId}/weighings/${weighingId}`],
      ["GET", `/animals/${animalId}/weight-gain`],
      ["GET", `/animals/${animalId}/applications`],
      ["GET", `/applications/${applicationId}`],
      ["PUT", `/applications/${applicationId}`, { productId, date: "2026-01-06" }],
      ["DELETE", `/applications/${applicationId}`],
      ["GET", `/animals/${animalId}/result`],
      ["GET", `/trades/${tradeId}`],
      ["PATCH", `/trades/${tradeId}`, { notes: "invadida" }],
      ["PATCH", `/trades/${tradeId}`, { items: [{ id: tradeItemId, unitPrice: 1 }] }],
      ["DELETE", `/trades/${tradeId}/items/${tradeItemId}`],
      ["DELETE", `/trades/${tradeId}`],
    ];

    for (const [method, url, payload] of attempts) {
      const response = await farmA.inject({ method: method as "GET", url, payload: payload as object });
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }

    expect(await snapshotFarmB()).toBe(before);
  });

  it("a fazenda A NÃO usa animal nem produto da fazenda B numa aplicação", async () => {
    const myAnimal = await createAnimal(farmA);
    const myProduct = await createProduct(farmA);

    const otherAnimal = await farmA.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: myProduct.id, date: "2026-01-05", animalIds: [myAnimal.id, b.animalId] },
    });
    expect(otherAnimal.statusCode).toBe(400);
    expect(otherAnimal.json().code).toBe("ANIMALS_NOT_FOUND");

    const otherProduct = await farmA.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: b.productId, date: "2026-01-05", animalIds: [myAnimal.id] },
    });
    expect(otherProduct.statusCode).toBe(404);
    expect(otherProduct.json().code).toBe("PRODUCT_NOT_FOUND");

    // editar a própria aplicação apontando para produto de B também é barrado
    const mine = await farmA.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: myProduct.id, date: "2026-01-05", animalIds: [myAnimal.id] },
    });
    const edit = await farmA.inject({
      method: "PUT",
      url: `/applications/${mine.json().id}`,
      payload: { productId: b.productId, date: "2026-01-05" },
    });
    expect(edit.statusCode).toBe(404);
  });

  it("a fazenda A NÃO inclui animal da fazenda B numa negociação (critério 17)", async () => {
    const before = await snapshotFarmB();
    const mine = await createAnimal(farmA);
    for (const type of ["SALE", "PURCHASE"]) {
      const response = await farmA.inject({
        method: "POST",
        url: "/trades",
        payload: {
          type,
          date: "2026-02-01",
          priceUnit: "PER_KG",
          items: [
            { animalId: mine.id, liveWeightKg: 300, unitPrice: 10 },
            { animalId: b.animalId, liveWeightKg: 300, unitPrice: 10 },
          ],
        },
      });
      expect(response.statusCode, type).toBe(422);
      expect(response.json().errors).toEqual([
        expect.objectContaining({ field: "items.1.animalId", code: "ANIMAL_NOT_FOUND" }),
      ]);
    }
    expect(await prisma.trade.count({ where: { farmId: farmA.farm.id } })).toBe(0);
    expect(await snapshotFarmB()).toBe(before);
  });

  it("tudo que a fazenda A cria fica com o farmId da sessão", async () => {
    const animal = await createAnimal(farmA);
    await addWeighing(farmA, animal.id, "2026-01-01", 200);
    const product = await createProduct(farmA);
    await farmA.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: "2026-01-05", animalIds: [animal.id] },
    });
    await sellAnimal(farmA, animal.id, "2026-01-10", 300, 11);

    const notA = { farmId: { not: farmA.farm.id } };
    expect(await prisma.animal.count({ where: { ...notA, id: animal.id } })).toBe(0);
    expect(await prisma.weighing.count({ where: { ...notA, animalId: animal.id } })).toBe(0);
    expect(await prisma.applicationAnimal.count({ where: { ...notA, animalId: animal.id } })).toBe(0);
    expect(await prisma.trade.count({ where: notA })).toBe(2); // só as da fazenda B
    expect(await prisma.tradeItem.count({ where: { ...notA, animalId: animal.id } })).toBe(0);
    expect(await prisma.weighing.count({ where: { animalId: animal.id, source: "SALE", ...notA } })).toBe(0);
  });

  it("farmId enviado pelo navegador é recusado (campo desconhecido)", async () => {
    const response = await farmA.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "X-1", sex: "MALE", category: "CALF", farmId: farmB.farm.id },
    });
    expect(response.statusCode).toBe(400);
    expect(await prisma.animal.count({ where: { tag: "X-1" } })).toBe(0);
  });

  it("farmId na query também não muda nada", async () => {
    const response = await farmA.inject({ url: `/animals?farmId=${farmB.farm.id}` });
    expect(response.statusCode).toBe(400);
  });

  it("duas fazendas podem usar o mesmo brinco; a mesma fazenda, não", async () => {
    const sameTag = await createAnimal(farmA, { tag: "B-001" });
    expect(sameTag.tag).toBe("B-001");

    const duplicate = await farmA.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "B-001", sex: "MALE", category: "CALF" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe("DUPLICATE_TAG");
  });
});
