import { describe, expect, it } from "vitest";
import { t, tOptional } from "./index.js";
import { errorMessage, fieldErrorMessage, fieldErrorsOf } from "./errors.js";
import { ptBR } from "./pt-BR.js";
import { ErrorCode } from "../../../src/lib/errors.js";
import { FieldErrorCode } from "../../../src/lib/validation-errors.js";

// G3 — textos fora do código. Estes testes garantem que a tela sempre tem uma
// frase para cada código que a API pode devolver.

describe("t()", () => {
  it("troca {nome} pelo valor", () => {
    expect(t("animal.delete.body", { tag: "BR-1" })).toContain("BR-1");
  });

  it("plural: 1 no singular; 0 e 2 no plural", () => {
    expect(t("common.animalsCount", { count: 1 })).toBe("1 animal");
    expect(t("common.animalsCount", { count: 2 })).toBe("2 animais");
    expect(t("common.animalsCount", { count: 0 })).toBe("0 animais");
  });

  it("tOptional devolve undefined para chave que não existe", () => {
    expect(tOptional("errors.codes.CODIGO_QUE_NAO_EXISTE")).toBeUndefined();
  });
});

describe("todo código da API tem tradução", () => {
  it.each(Object.values(ErrorCode))("errors.codes.%s", (code) => {
    expect(ptBR.errors.codes).toHaveProperty(code);
  });

  it.each(Object.values(FieldErrorCode).filter((code) => code !== "INVALID_FORMAT"))(
    "errors.fieldCodes.%s",
    (code) => {
      expect(ptBR.errors.fieldCodes).toHaveProperty(code);
    },
  );
});

describe("erros da API → frase", () => {
  it("sem resposta do servidor = sem conexão", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(t("errors.network"));
  });

  it("pelo código, nunca pelo texto que veio da API", () => {
    const message = errorMessage({ status: 409, code: "DUPLICATE_TAG", message: "texto do servidor" });
    expect(message).toBe(t("errors.codes.DUPLICATE_TAG"));
  });

  it("código desconhecido: 5xx → problema no sistema; 4xx → mensagem da tela", () => {
    expect(errorMessage({ status: 500, code: "NOVO" })).toBe(t("errors.server"));
    expect(errorMessage({ status: 400, code: "NOVO" }, "products.nameRequired")).toBe(
      t("products.nameRequired"),
    );
  });

  it("erro de campo usa os números da regra", () => {
    expect(fieldErrorMessage({ field: "tag", code: "TOO_LONG", params: { max: 50 } })).toBe(
      "Use no máximo 50 caracteres.",
    );
    expect(
      fieldErrorMessage({ field: "weightKg", code: "TOO_SMALL", params: { min: 0, inclusive: false } }),
    ).toBe(t("errors.fieldCodes.MUST_BE_POSITIVE"));
    expect(fieldErrorMessage({ field: "date", code: "INVALID_FORMAT", params: { format: "date" } })).toBe(
      t("errors.formats.date"),
    );
  });

  it("regra de negócio no campo usa a frase do código", () => {
    expect(fieldErrorMessage({ field: "category", code: "CATEGORY_INCOMPATIBLE_WITH_SEX" })).toBe(
      t("errors.codes.CATEGORY_INCOMPATIBLE_WITH_SEX"),
    );
  });

  it("fieldErrorsOf monta { campo: frase }", () => {
    expect(
      fieldErrorsOf({ status: 400, errors: [{ field: "tag", code: "REQUIRED" }] }),
    ).toEqual({ tag: t("errors.fieldCodes.REQUIRED") });
    expect(fieldErrorsOf({ status: 400 })).toBeNull();
  });
});
