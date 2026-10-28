import { describe, expect, it } from "vitest";
import { resolveAnimalProfile } from "./animal.service.js";
import { AppError } from "../lib/errors.js";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as AppError).code;
  }
  return null;
};

describe("resolveAnimalProfile — cadastro", () => {
  it("macho sem castrado informado usa o padrão da fazenda", () => {
    expect(resolveAnimalProfile(null, { sex: "MALE", category: "YEARLING" }, false).castrated).toBe(false);
    expect(resolveAnimalProfile(null, { sex: "MALE", category: "YEARLING" }, true).castrated).toBe(true);
  });

  it("macho com castrado informado usa o informado", () => {
    expect(resolveAnimalProfile(null, { sex: "MALE", category: "ADULT_MALE", castrated: true }, false).castrated).toBe(true);
  });

  it("fêmea fica com castrado vazio", () => {
    expect(resolveAnimalProfile(null, { sex: "FEMALE", category: "COW" }, true)).toEqual({
      sex: "FEMALE",
      category: "COW",
      castrated: null,
    });
  });

  it("fêmea com castrado informado → CASTRATED_ONLY_FOR_MALES (RN-ANIMAL-006)", () => {
    expect(codeOf(() => resolveAnimalProfile(null, { sex: "FEMALE", category: "COW", castrated: false }, false))).toBe(
      "CASTRATED_ONLY_FOR_MALES",
    );
  });

  it.each([
    ["FEMALE", "YEARLING"],
    ["FEMALE", "ADULT_MALE"],
    ["FEMALE", "BULL"],
    ["MALE", "HEIFER"],
    ["MALE", "COW"],
  ] as const)("%s + %s → CATEGORY_INCOMPATIBLE_WITH_SEX", (sex, category) => {
    expect(codeOf(() => resolveAnimalProfile(null, { sex, category }, false))).toBe("CATEGORY_INCOMPATIBLE_WITH_SEX");
  });
});

describe("resolveAnimalProfile — edição", () => {
  const garrote = { sex: "MALE", category: "YEARLING", castrated: true } as const;

  it("trocar só a categoria mantém o castrado que já tinha", () => {
    expect(resolveAnimalProfile(garrote, { category: "ADULT_MALE" }, false)).toEqual({
      sex: "MALE",
      category: "ADULT_MALE",
      castrated: true,
    });
  });

  it("corrigir o sexo para fêmea sem trocar a categoria é recusado", () => {
    expect(codeOf(() => resolveAnimalProfile(garrote, { sex: "FEMALE" }, false))).toBe("CATEGORY_INCOMPATIBLE_WITH_SEX");
  });

  it("corrigir para fêmea com categoria compatível apaga o castrado", () => {
    expect(resolveAnimalProfile(garrote, { sex: "FEMALE", category: "HEIFER" }, false).castrated).toBeNull();
  });

  it("bezerra corrigida para macho recebe o castrado padrão da fazenda", () => {
    const bezerra = { sex: "FEMALE", category: "CALF", castrated: null } as const;
    expect(resolveAnimalProfile(bezerra, { sex: "MALE" }, true)).toEqual({
      sex: "MALE",
      category: "CALF",
      castrated: true,
    });
  });
});
