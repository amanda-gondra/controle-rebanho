import { useId } from "react";
import type { Category, Sex } from "../types/animal.js";
import { CATEGORIES_BY_SEX } from "../types/categories.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t } from "../i18n/index.js";

// Categoria + castrado no cadastro e na edição do animal (G4).
// - Mostra só as categorias que combinam com o sexo escolhido (D-02).
// - "Castrado" aparece só para machos (RN-ANIMAL-006).
// Quem usa é responsável por limpar a categoria quando o sexo muda e ela deixa
// de combinar (ver handleSexChange nas páginas).

type Props = {
  sex: Sex | "";
  category: Category | "";
  onCategoryChange: (category: Category) => void;
  castrated: boolean;
  onCastratedChange: (castrated: boolean) => void;
  error?: string;
};

export function CategoryPicker({ sex, category, onCategoryChange, castrated, onCastratedChange, error }: Props) {
  const { labelOf } = useCategoryLabels();
  const selectId = useId();

  return (
    <>
      <div className="mb-5">
        <label htmlFor={selectId} className="block font-medium text-texto mb-1">
          {t("animal.form.category")} <span className="text-alerta">*</span>
        </label>
        <select
          id={selectId}
          value={sex ? category : ""}
          disabled={!sex}
          onChange={(e) => e.target.value && onCategoryChange(e.target.value as Category)}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={`w-full border rounded-lg px-3 py-2.5 text-texto bg-card cursor-pointer disabled:bg-bege disabled:text-texto-leve disabled:cursor-not-allowed ${
            error ? "border-alerta" : "border-borda"
          }`}
        >
          <option value="">{sex ? t("animal.form.chooseCategory") : t("animal.form.chooseSexFirst")}</option>
          {sex &&
            CATEGORIES_BY_SEX[sex].map((value) => (
              <option key={value} value={value}>
                {labelOf(value, sex)}
              </option>
            ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-alerta mt-1">
            {error}
          </p>
        )}
      </div>

      {sex === "MALE" && (
        <div className="mb-5">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="block font-medium text-texto">{t("animal.form.castrated")}</span>
              <span className="block text-sm text-texto-leve">{t("animal.form.castratedHelp")}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={castrated}
              onChange={(e) => onCastratedChange(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative inline-block w-11 h-6 shrink-0 rounded-full bg-borda-chip transition-colors peer-checked:bg-verde peer-focus-visible:ring-2 peer-focus-visible:ring-verde peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
            />
          </label>
        </div>
      )}
    </>
  );
}
