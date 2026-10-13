import { useCallback, useMemo } from "react";
import { useAuth } from "../components/AuthProvider.js";
import type { Category, Sex } from "../types/animal.js";
import { categoryLabelKey } from "../types/categories.js";

// Nomes das categorias DESTA fazenda (Configurações → Animais). O servidor já
// manda os 7 nomes resolvidos (personalizados + padrões) junto com a sessão.
export function useCategoryLabels() {
  const { account } = useAuth();
  const labels = account?.farm.settings.categoryLabels;

  // Nome de um animal: depende da categoria e do sexo (bezerro × bezerra)
  const labelOf = useCallback(
    (category: Category, sex: Sex) => labels?.[categoryLabelKey(category, sex)] ?? category,
    [labels],
  );

  // Nome para o FILTRO de categoria: a categoria CALF junta bezerro e bezerra
  const filterLabelOf = useCallback(
    (category: Category) =>
      category === "CALF"
        ? `${labels?.CALF_MALE ?? "Bezerro"} / ${labels?.CALF_FEMALE ?? "Bezerra"}`
        : (labels?.[category] ?? category),
    [labels],
  );

  return useMemo(() => ({ labelOf, filterLabelOf }), [labelOf, filterLabelOf]);
}
