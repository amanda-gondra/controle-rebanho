import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  DEFAULT_CATEGORY_LABELS,
  categoryLabelKey,
  duplicatedLabelKeys,
  isCategoryCompatible,
  mergeCategoryLabels,
  resolveCategoryLabels,
} from "./categories.js";

describe("categoria × sexo (D-02)", () => {
  it.each([
    ["CALF", "MALE", true],
    ["CALF", "FEMALE", true],
    ["HEIFER", "FEMALE", true],
    ["COW", "FEMALE", true],
    ["YEARLING", "MALE", true],
    ["ADULT_MALE", "MALE", true],
    ["BULL", "MALE", true],
    ["HEIFER", "MALE", false],
    ["COW", "MALE", false],
    ["YEARLING", "FEMALE", false],
    ["ADULT_MALE", "FEMALE", false],
    ["BULL", "FEMALE", false],
  ] as const)("%s + %s → %s", (category, sex, expected) => {
    expect(isCategoryCompatible(category, sex)).toBe(expected);
  });

  it("todas as categorias têm pelo menos um sexo", () => {
    for (const category of CATEGORIES) {
      expect(isCategoryCompatible(category, "MALE") || isCategoryCompatible(category, "FEMALE")).toBe(true);
    }
  });
});

describe("nomes exibidos das categorias", () => {
  it("bezerro e bezerra têm nomes separados", () => {
    expect(categoryLabelKey("CALF", "MALE")).toBe("CALF_MALE");
    expect(categoryLabelKey("CALF", "FEMALE")).toBe("CALF_FEMALE");
    expect(categoryLabelKey("YEARLING", "MALE")).toBe("YEARLING");
  });

  it("sem nada guardado, usa os padrões; ignora lixo no banco", () => {
    expect(resolveCategoryLabels({})).toEqual(DEFAULT_CATEGORY_LABELS);
    expect(resolveCategoryLabels(null)).toEqual(DEFAULT_CATEGORY_LABELS);
    expect(resolveCategoryLabels({ YEARLING: 42, OUTRA: "x", COW: "  " })).toEqual(DEFAULT_CATEGORY_LABELS);
    expect(resolveCategoryLabels({ YEARLING: "Novilho" }).YEARLING).toBe("Novilho");
  });

  it("guarda só o que difere do padrão; null ou o próprio padrão voltam ao padrão", () => {
    const first = mergeCategoryLabels(DEFAULT_CATEGORY_LABELS, { YEARLING: "  Novilho ", COW: "vaca" });
    expect(first.overrides).toEqual({ YEARLING: "Novilho" });
    expect(first.labels.YEARLING).toBe("Novilho");
    expect(first.labels.COW).toBe("Vaca");

    const second = mergeCategoryLabels(first.labels, { YEARLING: null });
    expect(second.overrides).toEqual({});
    expect(second.labels).toEqual(DEFAULT_CATEGORY_LABELS);
  });

  it("acusa nomes repetidos, sem diferenciar maiúsculas", () => {
    const { labels } = mergeCategoryLabels(DEFAULT_CATEGORY_LABELS, { BULL: "boi" });
    expect(duplicatedLabelKeys(labels)).toEqual(["BULL"]);
    expect(duplicatedLabelKeys(DEFAULT_CATEGORY_LABELS)).toEqual([]);
  });
});
