import { useCallback, useMemo } from "react";
import { useAuth } from "../components/AuthProvider.js";
import type { Category, Sex } from "../types/animal.js";
import { categoryLabelKey, resolveCategoryLabels, type CategoryLabelKey } from "../types/categories.js";
import { t } from "../i18n/index.js";

// Nomes das categorias DESTA fazenda (Configurações → Animais): os que a
// fazenda personalizou (vêm com a sessão) e, no resto, os padrões da tradução.
export function useCategoryLabels() {
  const { account } = useAuth();
  const custom = account?.farm.settings.categoryLabels;
  const labels = useMemo(() => resolveCategoryLabels(custom), [custom]);

  // Nome de um animal: depende da categoria e do sexo (bezerro × bezerra)
  const labelOf = useCallback(
    (category: Category, sex: Sex) => labels[categoryLabelKey(category, sex)],
    [labels],
  );

  // Nome para o FILTRO de categoria: a categoria CALF junta bezerro e bezerra
  const filterLabelOf = useCallback(
    (category: Category) =>
      category === "CALF"
        ? t("categories.calfFilter", { male: labels.CALF_MALE, female: labels.CALF_FEMALE })
        : labels[category],
    [labels],
  );

  // Nome de um grupo de preço (os 7 nomes — bezerro e bezerra separados)
  const labelOfKey = useCallback((key: CategoryLabelKey) => labels[key], [labels]);

  return useMemo(() => ({ labelOf, filterLabelOf, labelOfKey }), [labelOf, filterLabelOf, labelOfKey]);
}
