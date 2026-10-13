import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { createAnimal } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";
import { DEFAULT_CATEGORY_LABELS } from "../../src/lib/categories.js";

// CATEGORIAS (G4 — D-02, RN-ANIMAL-004/006/007). Critérios do Escopo §7 e da
// "Espec — Animais" (números entre parênteses).

const t = useTestApp();

const postAnimal = (payload: Record<string, unknown>) =>
  t.client.inject({
    method: "POST",
    url: "/animals",
    payload: { tag: `C-${Math.random().toString(36).slice(2, 8)}`, ...payload },
  });

const putAnimal = (id: string, payload: Record<string, unknown>) =>
  t.client.inject({ method: "PUT", url: `/animals/${id}`, payload });

const patchFarm = (payload: Record<string, unknown>) =>
  t.client.inject({ method: "PATCH", url: "/farm", payload });

describe("categoria × sexo no cadastro (Escopo G4, critério 1 · Espec critério 4)", () => {
  it.each([
    ["MALE", "CALF"],
    ["FEMALE", "CALF"],
    ["FEMALE", "HEIFER"],
    ["FEMALE", "COW"],
    ["MALE", "YEARLING"],
    ["MALE", "ADULT_MALE"],
    ["MALE", "BULL"],
  ])("%s + %s é aceito", async (sex, category) => {
    const response = await postAnimal({ sex, category });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ sex, category });
  });

  it.each([
    ["FEMALE", "YEARLING"],
    ["FEMALE", "ADULT_MALE"],
    ["FEMALE", "BULL"],
    ["MALE", "HEIFER"],
    ["MALE", "COW"],
  ])("%s + %s é recusado e nada é gravado", async (sex, category) => {
    const response = await postAnimal({ sex, category });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("CATEGORY_INCOMPATIBLE_WITH_SEX");
    expect(response.json().errors).toEqual([expect.objectContaining({ field: "category" })]);
    expect(await prisma.animal.count({ where: { farmId: t.client.farm.id } })).toBe(0);
  });

  it("categorias antigas não existem mais", async () => {
    const response = await postAnimal({ sex: "MALE", category: "STEER" });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });

  it("o banco também recusa a combinação errada (defesa extra)", async () => {
    await expect(
      prisma.animal.create({
        data: { farmId: t.client.farm.id, tag: "DB-1", sex: "FEMALE", category: "BULL" },
      }),
    ).rejects.toThrow();
  });
});

describe("castrado (RN-ANIMAL-006)", () => {
  it("macho sem castrado informado usa o padrão da fazenda (não)", async () => {
    const response = await postAnimal({ sex: "MALE", category: "YEARLING" });
    expect(response.json().castrated).toBe(false);
  });

  it("com o padrão da fazenda = sim, macho novo vem castrado", async () => {
    await patchFarm({ defaultCastrated: true });
    const response = await postAnimal({ sex: "MALE", category: "ADULT_MALE" });
    expect(response.json().castrated).toBe(true);
  });

  it("o informado vale mais que o padrão", async () => {
    await patchFarm({ defaultCastrated: true });
    const response = await postAnimal({ sex: "MALE", category: "BULL", castrated: false });
    expect(response.json().castrated).toBe(false);
  });

  it("fêmea fica sem castrado, mesmo com o padrão da fazenda = sim", async () => {
    await patchFarm({ defaultCastrated: true });
    const response = await postAnimal({ sex: "FEMALE", category: "HEIFER" });
    expect(response.json().castrated).toBeNull();
  });

  it("fêmea com castrado: true → 400 CASTRATED_ONLY_FOR_MALES (Espec critério 5)", async () => {
    const response = await postAnimal({ sex: "FEMALE", category: "COW", castrated: true });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("CASTRATED_ONLY_FOR_MALES");
  });
});

describe("edição (Espec critério 15)", () => {
  it("corrigir o sexo de um garrote para fêmea sem trocar a categoria é recusado", async () => {
    const garrote = await createAnimal(t.client, { sex: "MALE", category: "YEARLING" });

    const response = await putAnimal(garrote.id, { sex: "FEMALE" });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("CATEGORY_INCOMPATIBLE_WITH_SEX");

    const saved = await prisma.animal.findUniqueOrThrow({ where: { id: garrote.id } });
    expect(saved).toMatchObject({ sex: "MALE", category: "YEARLING" });
  });

  it("corrigir sexo e categoria juntos funciona e apaga o castrado", async () => {
    const garrote = await createAnimal(t.client, { sex: "MALE", category: "YEARLING", castrated: true });

    const response = await putAnimal(garrote.id, { sex: "FEMALE", category: "HEIFER" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ sex: "FEMALE", category: "HEIFER", castrated: null });
  });

  it("trocar só a categoria (garrote → boi) mantém o castrado", async () => {
    const garrote = await createAnimal(t.client, { sex: "MALE", category: "YEARLING", castrated: true });

    const response = await putAnimal(garrote.id, { category: "ADULT_MALE" });
    expect(response.json()).toMatchObject({ category: "ADULT_MALE", castrated: true });
  });

  it("marcar castrado numa vaca é recusado", async () => {
    const vaca = await createAnimal(t.client, { sex: "FEMALE", category: "COW" });
    const response = await putAnimal(vaca.id, { castrated: true });
    expect(response.json().code).toBe("CASTRATED_ONLY_FOR_MALES");
  });
});

describe("nomes das categorias da fazenda (RN-ANIMAL-007 · Espec Configurações, critérios 3 e 7)", () => {
  it("conta nova vem com os 7 nomes padrão", async () => {
    const farm = (await t.client.inject({ url: "/farm" })).json();
    expect(farm.settings.categoryLabels).toEqual(DEFAULT_CATEGORY_LABELS);
    expect(farm.defaults.categoryLabels).toEqual(DEFAULT_CATEGORY_LABELS);
  });

  it("renomear garrote para novilho muda só o nome; nenhum animal muda", async () => {
    const garrote = await createAnimal(t.client, { sex: "MALE", category: "YEARLING" });

    const response = await patchFarm({ categoryLabels: { YEARLING: "  Novilho " } });
    expect(response.statusCode).toBe(200);
    expect(response.json().settings.categoryLabels).toEqual({ ...DEFAULT_CATEGORY_LABELS, YEARLING: "Novilho" });

    const me = (await t.client.inject({ url: "/auth/me" })).json();
    expect(me.farm.settings.categoryLabels.YEARLING).toBe("Novilho");

    const saved = await prisma.animal.findUniqueOrThrow({ where: { id: garrote.id } });
    expect(saved.category).toBe("YEARLING");

    // O banco guarda só o que mudou
    const farm = await prisma.farm.findUniqueOrThrow({ where: { id: t.client.farm.id } });
    expect(farm.categoryLabels).toEqual({ YEARLING: "Novilho" });
  });

  it("mudar um nome não apaga os outros já personalizados", async () => {
    await patchFarm({ categoryLabels: { YEARLING: "Novilho" } });
    await patchFarm({ categoryLabels: { BULL: "Reprodutor" } });
    const farm = (await t.client.inject({ url: "/farm" })).json();
    expect(farm.settings.categoryLabels).toMatchObject({ YEARLING: "Novilho", BULL: "Reprodutor" });
  });

  it("null volta ao padrão", async () => {
    await patchFarm({ categoryLabels: { YEARLING: "Novilho" } });
    const response = await patchFarm({ categoryLabels: { YEARLING: null } });
    expect(response.json().settings.categoryLabels.YEARLING).toBe("Garrote");
  });

  it("dois nomes iguais → 400 DUPLICATE_CATEGORY_LABEL e nada muda", async () => {
    const response = await patchFarm({ categoryLabels: { BULL: "boi" } });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("DUPLICATE_CATEGORY_LABEL");
    expect(response.json().errors).toEqual([expect.objectContaining({ field: "categoryLabels.BULL" })]);

    const farm = (await t.client.inject({ url: "/farm" })).json();
    expect(farm.settings.categoryLabels.BULL).toBe("Touro");
  });

  it.each([
    [{ YEARLING: "" }, "nome vazio"],
    [{ YEARLING: "x".repeat(31) }, "nome com mais de 30 letras"],
    [{ STEER: "Boi" }, "chave que não existe"],
  ] as [Record<string, string>, string][])("%o → 400 (%s)", async (categoryLabels, _reason) => {
    const response = await patchFarm({ categoryLabels });
    expect(response.statusCode).toBe(400);
  });
});
