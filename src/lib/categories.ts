import type { Category, Sex } from "@prisma/client";

// Categorias do rebanho (G4 — D-02). Fonte única das regras de categoria.
//
//   Fêmea: bezerra (CALF) · novilha (HEIFER) · vaca (COW)
//   Macho: bezerro (CALF) · garrote (YEARLING) · boi (ADULT_MALE) · touro (BULL)
//
// A categoria muda só quando o produtor informa — nunca sozinha pela idade
// (RN-ANIMAL-005). A mesma regra de sexo também está no banco (CHECK da
// migration G4), como defesa extra.

export const CATEGORIES = ["CALF", "HEIFER", "COW", "YEARLING", "ADULT_MALE", "BULL"] as const;

// Quais sexos cada categoria aceita
export const CATEGORY_SEXES: Record<Category, readonly Sex[]> = {
  CALF: ["MALE", "FEMALE"],
  HEIFER: ["FEMALE"],
  COW: ["FEMALE"],
  YEARLING: ["MALE"],
  ADULT_MALE: ["MALE"],
  BULL: ["MALE"],
};

export function isCategoryCompatible(category: Category, sex: Sex): boolean {
  return CATEGORY_SEXES[category].includes(sex);
}

// ── Nomes exibidos (RN-ANIMAL-007, D-21) ────────────────────────────────────
// São 7 nomes porque o bezerro e a bezerra têm a mesma categoria (CALF), mas
// nomes diferentes. A fazenda pode trocar qualquer um ("garrote" → "novilho");
// o código da categoria e os registros nunca mudam.

export const CATEGORY_LABEL_KEYS = [
  "CALF_MALE",
  "CALF_FEMALE",
  "YEARLING",
  "ADULT_MALE",
  "BULL",
  "HEIFER",
  "COW",
] as const;

export type CategoryLabelKey = (typeof CATEGORY_LABEL_KEYS)[number];
export type CategoryLabels = Record<CategoryLabelKey, string>;

// Padrões em português (a 1.0 é só Brasil — D-01). Na G3 os textos saem do
// código; os nomes PERSONALIZADOS continuam sendo dado da fazenda.
export const DEFAULT_CATEGORY_LABELS: CategoryLabels = {
  CALF_MALE: "Bezerro",
  CALF_FEMALE: "Bezerra",
  YEARLING: "Garrote",
  ADULT_MALE: "Boi",
  BULL: "Touro",
  HEIFER: "Novilha",
  COW: "Vaca",
};

export const MAX_CATEGORY_LABEL_LENGTH = 30;

// Qual dos 7 nomes vale para um animal
export function categoryLabelKey(category: Category, sex: Sex): CategoryLabelKey {
  if (category === "CALF") return sex === "FEMALE" ? "CALF_FEMALE" : "CALF_MALE";
  return category;
}

// Compara nomes sem diferenciar maiúsculas e espaços nas pontas
export const normalizeLabel = (label: string) => label.trim().toLocaleLowerCase("pt-BR");

// O banco guarda só os nomes que a fazenda MUDOU (objeto vazio = todos no
// padrão). Aqui junta com os padrões e ignora qualquer coisa inválida que
// esteja no banco (nunca quebra a leitura).
export function resolveCategoryLabels(stored: unknown): CategoryLabels {
  const labels = { ...DEFAULT_CATEGORY_LABELS };
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of CATEGORY_LABEL_KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim() !== "") labels[key] = value.trim();
    }
  }
  return labels;
}

// Junta os nomes atuais com os enviados e devolve só o que difere do padrão
// (o que vai para o banco). `null` ou o próprio nome padrão = voltar ao padrão.
export function mergeCategoryLabels(
  current: CategoryLabels,
  changes: Partial<Record<CategoryLabelKey, string | null>>,
): { labels: CategoryLabels; overrides: Partial<CategoryLabels> } {
  const labels = { ...current };
  for (const key of CATEGORY_LABEL_KEYS) {
    if (!(key in changes)) continue;
    const value = changes[key];
    labels[key] = value == null ? DEFAULT_CATEGORY_LABELS[key] : value.trim();
  }

  const overrides: Partial<CategoryLabels> = {};
  for (const key of CATEGORY_LABEL_KEYS) {
    if (normalizeLabel(labels[key]) !== normalizeLabel(DEFAULT_CATEGORY_LABELS[key])) {
      overrides[key] = labels[key];
    } else {
      labels[key] = DEFAULT_CATEGORY_LABELS[key];
    }
  }
  return { labels, overrides };
}

// Nomes repetidos (ex.: "Boi" para duas categorias) confundem lista e filtro.
// Devolve as chaves que repetem o nome de outra (vazio = tudo certo).
export function duplicatedLabelKeys(labels: CategoryLabels): CategoryLabelKey[] {
  const seen = new Map<string, CategoryLabelKey>();
  const duplicated: CategoryLabelKey[] = [];
  for (const key of CATEGORY_LABEL_KEYS) {
    const normalized = normalizeLabel(labels[key]);
    if (seen.has(normalized)) duplicated.push(key);
    else seen.set(normalized, key);
  }
  return duplicated;
}
