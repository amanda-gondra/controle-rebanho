import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { createAnimal, createProduct, daysFromToday } from "../helpers/factories.js";

// G3 — "a API devolve códigos; o frontend traduz". Todo erro de campo traz um
// `code` estável (e `params` quando a frase precisa de número), para a tela
// montar a mensagem no idioma da pessoa.

const t = useTestApp();

type FieldErrorBody = { field: string; code: string; params?: Record<string, unknown> };

const errorsOf = (response: { json: () => { errors?: FieldErrorBody[] } }) => response.json().errors ?? [];

describe("códigos de erro por campo", () => {
  it("campo ausente → REQUIRED; texto em branco → REQUIRED", async () => {
    const response = await t.client.inject({ method: "POST", url: "/animals", payload: { tag: "  ", sex: "MALE" } });
    expect(response.statusCode).toBe(400);
    expect(errorsOf(response)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "tag", code: "REQUIRED" }),
        expect.objectContaining({ field: "category", code: "REQUIRED" }),
      ]),
    );
  });

  it("texto longo → TOO_LONG com o limite", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "x".repeat(51), sex: "MALE", category: "CALF" },
    });
    expect(errorsOf(response)).toEqual([expect.objectContaining({ field: "tag", code: "TOO_LONG", params: { max: 50 } })]);
  });

  it("opção que não existe → INVALID_OPTION; campo a mais → UNKNOWN_FIELD", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "A", sex: "X", category: "CALF", cor: "preta" },
    });
    expect(errorsOf(response)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sex", code: "INVALID_OPTION" }),
        expect.objectContaining({ field: "cor", code: "UNKNOWN_FIELD" }),
      ]),
    );
  });

  it("data em formato errado → INVALID_FORMAT (date); data futura → FUTURE_DATE", async () => {
    const animal = await createAnimal(t.client);
    const badFormat = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/weighings`,
      payload: { date: "13/10/2026", weightKg: 300 },
    });
    expect(errorsOf(badFormat)).toEqual([
      expect.objectContaining({ field: "date", code: "INVALID_FORMAT", params: { format: "date" } }),
    ]);

    const future = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/weighings`,
      payload: { date: daysFromToday(2), weightKg: 300 },
    });
    expect(errorsOf(future)).toEqual([expect.objectContaining({ field: "date", code: "FUTURE_DATE" })]);
  });

  it("peso com 3 casas → MAX_2_DECIMALS; peso zero → TOO_SMALL", async () => {
    const animal = await createAnimal(t.client);
    const decimals = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/weighings`,
      payload: { date: daysFromToday(-1), weightKg: 300.123 },
    });
    expect(errorsOf(decimals)).toEqual([expect.objectContaining({ field: "weightKg", code: "MAX_2_DECIMALS" })]);

    const zero = await t.client.inject({
      method: "POST",
      url: `/animals/${animal.id}/weighings`,
      payload: { date: daysFromToday(-1), weightKg: 0 },
    });
    expect(errorsOf(zero)).toEqual([
      expect.objectContaining({ field: "weightKg", code: "TOO_SMALL", params: { min: 0, inclusive: false } }),
    ]);
  });

  it("antecedência quebrada → NOT_INTEGER; acima do limite → TOO_BIG", async () => {
    const broken = await t.client.inject({ method: "PATCH", url: "/farm", payload: { reapplyAlertDays: 2.5 } });
    expect(errorsOf(broken)).toEqual([expect.objectContaining({ field: "reapplyAlertDays", code: "NOT_INTEGER" })]);

    const big = await t.client.inject({ method: "PATCH", url: "/farm", payload: { reapplyAlertDays: 61 } });
    expect(errorsOf(big)).toEqual([
      expect.objectContaining({ field: "reapplyAlertDays", code: "TOO_BIG", params: { max: 60, inclusive: true } }),
    ]);
  });

  it("aplicação: nenhum animal → TOO_FEW; repetido → DUPLICATE_ITEMS; reaplicação antes → REAPPLY_BEFORE_DATE", async () => {
    const product = await createProduct(t.client);
    const animal = await createAnimal(t.client);
    const post = (payload: object) => t.client.inject({ method: "POST", url: "/applications", payload });
    const date = daysFromToday(-1);

    expect(errorsOf(await post({ productId: product.id, date, animalIds: [] }))).toEqual([
      expect.objectContaining({ field: "animalIds", code: "TOO_FEW", params: { min: 1 } }),
    ]);
    expect(errorsOf(await post({ productId: product.id, date, animalIds: [animal.id, animal.id] }))).toEqual([
      expect.objectContaining({ field: "animalIds", code: "DUPLICATE_ITEMS" }),
    ]);
    expect(
      errorsOf(await post({ productId: product.id, date, reapplyDate: daysFromToday(-5), animalIds: [animal.id] })),
    ).toEqual([expect.objectContaining({ field: "reapplyDate", code: "REAPPLY_BEFORE_DATE" })]);
  });

  it("filtro inválido na URL → INVALID_OPTION", async () => {
    const response = await t.client.inject({ url: "/animals?status=QUALQUER" });
    expect(errorsOf(response)).toEqual([expect.objectContaining({ field: "status", code: "INVALID_OPTION" })]);
  });

  it("regras de negócio também trazem o código no campo", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "V-1", sex: "MALE", category: "COW" },
    });
    expect(errorsOf(response)).toEqual([
      expect.objectContaining({ field: "category", code: "CATEGORY_INCOMPATIBLE_WITH_SEX" }),
    ]);
  });

  it("todo erro de campo tem field, code e error (texto para quem lê a API)", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "", sex: "?", category: "?", birthDate: "ontem", extra: 1 },
    });
    for (const fieldError of errorsOf(response)) {
      expect(fieldError).toEqual(
        expect.objectContaining({ field: expect.any(String), code: expect.any(String), error: expect.any(String) }),
      );
    }
  });
});
