import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import {
  NON_EXISTENT_ID,
  createAnimal,
  createProduct,
  daysFromToday,
  today,
} from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

const t = useTestApp();

async function createApplication(body: Record<string, unknown>) {
  return t.app.inject({ method: "POST", url: "/applications", payload: body });
}

describe("produtos", () => {
  it("cadastra (sem espaços nas pontas) e lista com filtro por tipo", async () => {
    await createProduct(t.app, { name: "  Ivermectina ", type: "DEWORMER" });
    await createProduct(t.app, { name: "Aftosa", type: "VACCINE" });

    const response = await t.app.inject({ url: "/products?type=DEWORMER" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].name).toBe("Ivermectina");
  });

  it("recusa nome vazio, nome longo e tipo inválido", async () => {
    for (const payload of [
      { name: "  ", type: "VACCINE" },
      { name: "x".repeat(101), type: "VACCINE" },
      { name: "Aftosa", type: "PILL" },
    ]) {
      const response = await t.app.inject({ method: "POST", url: "/products", payload });
      expect(response.statusCode).toBe(400);
    }
  });
});

describe("aplicações", () => {
  it("registra em lote e guarda individual por animal", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const b = await createAnimal(t.app);

    const response = await createApplication({
      productId: product.id,
      date: "2026-01-10",
      reapplyDate: "2026-07-10",
      animalIds: [a.id, b.id],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().animals).toHaveLength(2);

    const history = await t.app.inject({ url: `/animals/${a.id}/applications` });
    expect(history.json()).toHaveLength(1);
  });

  it("o mesmo animal duas vezes → 400 (antes: mensagem errada de brinco)", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const response = await createApplication({
      productId: product.id,
      date: "2026-01-10",
      animalIds: [a.id, a.id],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("animal inexistente na lista → 400 ANIMALS_NOT_FOUND e nada é gravado", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const response = await createApplication({
      productId: product.id,
      date: "2026-01-10",
      animalIds: [a.id, NON_EXISTENT_ID],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("ANIMALS_NOT_FOUND");
    expect(await prisma.application.count()).toBe(0);
  });

  it("produto inexistente → 404 PRODUCT_NOT_FOUND", async () => {
    const a = await createAnimal(t.app);
    const response = await createApplication({
      productId: NON_EXISTENT_ID,
      date: "2026-01-10",
      animalIds: [a.id],
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("PRODUCT_NOT_FOUND");
  });

  it.each([
    ["reaplicação antes da aplicação", { reapplyDate: "2026-01-09" }],
    ["reaplicação no mesmo dia", { reapplyDate: "2026-01-10" }],
    ["data no futuro", { date: daysFromToday(1), reapplyDate: undefined }],
    ["lista vazia de animais", { animalIds: [] }],
  ])("recusa %s com 400", async (_label, override) => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const response = await createApplication({
      productId: product.id,
      date: "2026-01-10",
      animalIds: [a.id],
      ...override,
    });
    expect(response.statusCode).toBe(400);
  });

  it("edita os dados, mas exige produto existente", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const created = (await createApplication({
      productId: product.id,
      date: "2026-01-10",
      animalIds: [a.id],
    })).json();

    const ok = await t.app.inject({
      method: "PUT",
      url: `/applications/${created.id}`,
      payload: { productId: product.id, date: "2026-01-11", notes: "corrigido" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().notes).toBe("corrigido");

    const badProduct = await t.app.inject({
      method: "PUT",
      url: `/applications/${created.id}`,
      payload: { productId: NON_EXISTENT_ID, date: "2026-01-11" },
    });
    expect(badProduct.statusCode).toBe(404);
  });

  it("excluir a aplicação remove as ligações, mas não os animais", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const created = (await createApplication({
      productId: product.id,
      date: "2026-01-10",
      animalIds: [a.id],
    })).json();

    const response = await t.app.inject({ method: "DELETE", url: `/applications/${created.id}` });
    expect(response.statusCode).toBe(204);
    expect(await prisma.applicationAnimal.count()).toBe(0);
    expect(await prisma.animal.count()).toBe(1);

    const again = await t.app.inject({ method: "DELETE", url: `/applications/${created.id}` });
    expect(again.statusCode).toBe(404);
  });
});

describe("GET /alerts", () => {
  it("mostra reaplicações vencidas e dos próximos 7 dias; esconde as distantes", async () => {
    const product = await createProduct(t.app);
    const a = await createAnimal(t.app);
    const base = daysFromToday(-30);

    const make = (reapplyDate: string) =>
      createApplication({ productId: product.id, date: base, reapplyDate, animalIds: [a.id] });

    await make(daysFromToday(-1)); // vencida
    await make(today()); // hoje: alerta, não vencida
    await make(daysFromToday(7)); // limite da janela
    await make(daysFromToday(8)); // fora

    const response = await t.app.inject({ url: "/alerts" });
    expect(response.statusCode).toBe(200);
    const alerts = response.json() as { overdue: boolean }[];
    expect(alerts).toHaveLength(3);
    expect(alerts.map((x) => x.overdue)).toEqual([true, false, false]);
  });
});
