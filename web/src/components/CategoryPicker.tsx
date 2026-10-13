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

  return (
    <>
      <div className="mb-5">
        <p id="category-label" className="block font-medium text-texto mb-1">
          {t("animal.form.category")} <span className="text-alerta">*</span>
        </p>
        {!sex ? (
          <p className="text-sm text-texto-leve border border-dashed border-borda-chip rounded-lg px-3 py-3">
            {t("animal.form.chooseSexFirst")}
          </p>
        ) : (
          <div role="radiogroup" aria-labelledby="category-label" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES_BY_SEX[sex].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={category === value}
                onClick={() => onCategoryChange(value)}
                className={`py-2.5 px-2 rounded-lg border font-medium cursor-pointer ${
                  category === value
                    ? "bg-verde border-verde text-white"
                    : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {labelOf(value, sex)}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-alerta mt-1">{error}</p>}
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
