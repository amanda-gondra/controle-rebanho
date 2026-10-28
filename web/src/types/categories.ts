import type { Category, Sex } from "./animal.js";
import { t } from "../i18n/index.js";

// Regras de categoria na tela (G4 — D-02). A regra que VALE é a do servidor
// (src/lib/categories.ts); aqui ela só serve para mostrar as opções certas.

// Categorias de cada sexo, na ordem em que aparecem nos botões
export const CATEGORIES_BY_SEX: Record<Sex, Category[]> = {
  MALE: ["CALF", "YEARLING", "ADULT_MALE", "BULL"],
  FEMALE: ["CALF", "HEIFER", "COW"],
};

export const isCategoryCompatible = (category: Category, sex: Sex) =>
  CATEGORIES_BY_SEX[sex].includes(category);

// Os 7 nomes que a fazenda pode personalizar (bezerro e bezerra são a mesma
// categoria, CALF, com nomes diferentes)
export const CATEGORY_LABEL_KEYS = [
  "CALF_MALE",
  "YEARLING",
  "ADULT_MALE",
  "BULL",
  "CALF_FEMALE",
  "HEIFER",
  "COW",
] as const;

export type CategoryLabelKey = (typeof CATEGORY_LABEL_KEYS)[number];
export type CategoryLabels = Record<CategoryLabelKey, string>;

export const SEX_OF_LABEL_KEY: Record<CategoryLabelKey, Sex> = {
  CALF_MALE: "MALE",
  YEARLING: "MALE",
  ADULT_MALE: "MALE",
  BULL: "MALE",
  CALF_FEMALE: "FEMALE",
  HEIFER: "FEMALE",
  COW: "FEMALE",
};

export function categoryLabelKey(category: Category, sex: Sex): CategoryLabelKey {
  if (category === "CALF") return sex === "FEMALE" ? "CALF_FEMALE" : "CALF_MALE";
  return category;
}

// Nome PADRÃO de cada uma (vem da tradução — G3)
export const defaultCategoryLabel = (key: CategoryLabelKey) => t(`categories.${key}`);

// Os 7 nomes da fazenda: os personalizados (vindos da API) + os padrões
export function resolveCategoryLabels(custom: Partial<CategoryLabels> | undefined): CategoryLabels {
  return Object.fromEntries(
    CATEGORY_LABEL_KEYS.map((key) => [key, custom?.[key] ?? defaultCategoryLabel(key)]),
  ) as CategoryLabels;
}

// Ordem dos filtros de categoria (lista do rebanho, aplicação sanitária)
export const CATEGORY_FILTER_ORDER: Category[] = ["CALF", "YEARLING", "ADULT_MALE", "BULL", "HEIFER", "COW"];
