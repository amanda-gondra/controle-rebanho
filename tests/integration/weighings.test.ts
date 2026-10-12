import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import {
  NON_EXISTENT_ID,
  addWeighing,
  createAnimal,
  daysFromToday,
  today,
} from "../helpers/factories.js";

const t = useTestApp();

describe("pesagens", () => {
  it("registra, lista (mais recente primeiro), edita e exclui", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, "2026-01-01", 200);
    const second = await addWeighing(t.app, animal.id, "2026-02-01", 230);

    const list = await t.app.inject({ url: `/animals/${animal.id}/weighings` });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((w: { weightKg: string }) => Number(w.weightKg))).toEqual([230, 200]);

    const edit = await t.app.inject({
      method: "PUT",
      url: `/animals/${animal.id}/weighings/${second.id}`,
      payload: { date: "2026-02-02", weightKg: 231.25 },
    });
    expect(edit.statusCode).toBe(200);
    expect(Number(edit.json().weightKg)).toBe(231.25);

    const remove = await t.app.inject({
      method: "DELETE",
      url: `/animals/${animal.id}/weighings/${second.id}`,
    });
    expect(remove.statusCode).toBe(204);
  });

  it.each([
    ["peso zero", { weightKg: 0 }],
    ["peso negativo", { weightKg: -5 }],
    ["peso acima do que o banco guarda (F-14)", { weightKg: 10000 }],
    ["peso com 3 casas decimais", { weightKg: 200.123 }],
    ["peso não numérico", { weightKg: "abc" }],
    ["data de amanhã (fuso da fazenda — F-04)", { date: daysFromToday(1) }],
  ])("recusa %s com 400, nunca 500", async (_label, override) => {
    const animal = await createAnimal(t.app);
    const response = await t.app.inject({
      method: "POST",
      url: `/animals/${animal.id}/weighings`,
      payload: { date: "2026-01-01", weightKg: 200, ...override },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("aceita pesagem com a data de hoje", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, today(), 200);
  });

  it("pesagem em animal inexistente → 404", async () => {
    const response = await t.app.inject({
      method: "POST",
      url: `/animals/${NON_EXISTENT_ID}/weighings`,
      payload: { date: "2026-01-01", weightKg: 200 },
    });
    expect(response.statusCode).toBe(404);
  });

  it("não edita nem exclui pesagem de OUTRO animal trocando o id na URL (manipulação de ID)", async () => {
    const owner = await createAnimal(t.app);
    const other = await createAnimal(t.app);
    const weighing = await addWeighing(t.app, owner.id, "2026-01-01", 200);

    const edit = await t.app.inject({
      method: "PUT",
      url: `/animals/${other.id}/weighings/${weighing.id}`,
      payload: { date: "2026-01-01", weightKg: 999 },
    });
    expect(edit.statusCode).toBe(404);
    expect(edit.json().code).toBe("WEIGHING_NOT_FOUND");

    const remove = await t.app.inject({
      method: "DELETE",
      url: `/animals/${other.id}/weighings/${weighing.id}`,
    });
    expect(remove.statusCode).toBe(404);

    const list = await t.app.inject({ url: `/animals/${owner.id}/weighings` });
    expect(Number(list.json()[0].weightKg)).toBe(200);
  });
});

describe("GET /animals/:id/weight-gain", () => {
  it("calcula ganho e GMD", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, "2024-06-01", 180);
    await addWeighing(t.app, animal.id, "2024-12-01", 300);

    const response = await t.app.inject({ url: `/animals/${animal.id}/weight-gain` });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ totalGainKg: 120, days: 183 });
  });

  it("menos de 2 pesagens → 422 INSUFFICIENT_WEIGHINGS", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, "2024-06-01", 180);
    const response = await t.app.inject({ url: `/animals/${animal.id}/weight-gain` });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("INSUFFICIENT_WEIGHINGS");
  });

  it("pesagens no mesmo dia → 422 SAME_DAY_WEIGHINGS (F-09)", async () => {
    const animal = await createAnimal(t.app);
    await addWeighing(t.app, animal.id, "2024-06-01", 180);
    await addWeighing(t.app, animal.id, "2024-06-01", 190);
    const response = await t.app.inject({ url: `/animals/${animal.id}/weight-gain` });
    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe("SAME_DAY_WEIGHINGS");
  });
});
