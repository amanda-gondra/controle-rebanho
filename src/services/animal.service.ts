import type { Category, Sex } from "@prisma/client";
import { ErrorCode, ruleError } from "../lib/errors.js";
import { isCategoryCompatible } from "../lib/categories.js";

// Regras de categoria e castração do animal (G4 — RN-ANIMAL-004 e 006).
// Função pura: recebe o animal atual (ou null no cadastro), o que mudou e o
// padrão "castrado" da fazenda, e devolve o resultado final — ou lança o erro.

type Profile = { sex: Sex; category: Category; castrated: boolean | null };

type Changes = { sex?: Sex; category?: Category; castrated?: boolean };

export function resolveAnimalProfile(
  current: Profile | null,
  changes: Changes,
  defaultCastrated: boolean,
): Profile {
  const sex = changes.sex ?? current?.sex;
  const category = changes.category ?? current?.category;
  if (!sex || !category) {
    // O schema de cadastro já exige os dois; aqui é só garantia de tipo.
    throw new Error("Sexo e categoria são obrigatórios.");
  }

  if (!isCategoryCompatible(category, sex)) {
    throw ruleError(
      ErrorCode.CATEGORY_INCOMPATIBLE_WITH_SEX,
      "Essa categoria não combina com o sexo escolhido.",
      [{ field: "category", error: "Essa categoria não combina com o sexo escolhido." }],
    );
  }

  // Fêmea: castrado não existe (fica vazio)
  if (sex === "FEMALE") {
    if (changes.castrated !== undefined) {
      throw ruleError(ErrorCode.CASTRATED_ONLY_FOR_MALES, "Castrado só vale para machos.", [
        { field: "castrated", error: "Castrado só vale para machos." },
      ]);
    }
    return { sex, category, castrated: null };
  }

  // Macho: o que foi informado; senão mantém o que já tinha; senão o padrão da fazenda
  const castrated =
    changes.castrated ??
    (current?.sex === "MALE" ? current.castrated : null) ??
    defaultCastrated;

  return { sex, category, castrated };
}
