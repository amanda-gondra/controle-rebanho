import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { CATEGORY_LABEL_KEYS, SEX_OF_LABEL_KEY, type CategoryLabelKey } from "../types/categories.js";
import type { NewAnimalDraft } from "../types/tradeForm.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t } from "../i18n/index.js";

// Compra em lote que CADASTRA os animais (G5 — D-36, F-NEG-03): uma linha por
// animal comprado com brinco, categoria (o nome já diz o sexo), castrado
// (machos) e raça. O peso e o preço vêm no passo 3, como na venda.
// Para ir rápido: "Repetir a anterior" copia categoria, castrado e raça, e
// "Adicionar N linhas" cria várias de uma vez — só falta digitar os brincos.

type Props = {
  rows: NewAnimalDraft[];
  onChange: (rows: NewAnimalDraft[]) => void;
  newKey: () => string;
  defaultCastrated: boolean;
  problems: Record<string, string>; // conferência da tela ou do servidor, por linha
  showProblems: boolean;
};

const MAX_ADD_AT_ONCE = 200;

export function NewAnimalsEditor({ rows, onChange, newKey, defaultCastrated, problems, showProblems }: Props) {
  const { labelOfKey } = useCategoryLabels();
  const [howMany, setHowMany] = useState("10");

  const blank = (): NewAnimalDraft => ({ key: newKey(), tag: "", group: "", castrated: defaultCastrated, breed: "" });
  // Copia da última linha tudo menos o brinco
  const copyOfLast = (): NewAnimalDraft => {
    const last = rows[rows.length - 1];
    return last ? { ...last, key: newKey(), tag: "" } : blank();
  };

  const update = (key: string, patch: Partial<NewAnimalDraft>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function addMany() {
    const count = Math.min(Math.max(Math.trunc(Number(howMany)) || 0, 1), MAX_ADD_AT_ONCE);
    onChange([...rows, ...Array.from({ length: count }, copyOfLast)]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-suave">{t("trade.newAnimals.help")}</p>

      {rows.length === 0 && <p className="text-sm text-texto-leve">{t("trade.newAnimals.empty")}</p>}

      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const isMale = row.group !== "" && SEX_OF_LABEL_KEY[row.group] === "MALE";
          const problem = showProblems ? problems[row.key] : undefined;
          const label = (field: string) => t("trade.newAnimals.fieldOfRow", { field, number: index + 1 });
          return (
            <li
              key={row.key}
              className={`border rounded-lg p-3 ${problem ? "border-alerta" : "border-borda"}`}
            >
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-xs text-texto-leve w-6 pb-2">{index + 1}</span>
                <label className="flex flex-col gap-1 text-xs text-texto-suave">
                  {t("trade.newAnimals.tag")}
                  <input
                    value={row.tag}
                    maxLength={50}
                    aria-label={label(t("trade.newAnimals.tag"))}
                    aria-invalid={!!problem}
                    data-nav={`tag-${index}`}
                    onChange={(e) => update(row.key, { tag: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      document.querySelector<HTMLInputElement>(`[data-nav="tag-${index + 1}"]`)?.focus();
                    }}
                    className="w-28 border border-borda rounded-lg px-2 py-1.5 text-sm text-texto"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-texto-suave">
                  {t("trade.newAnimals.category")}
                  <select
                    value={row.group}
                    aria-label={label(t("trade.newAnimals.category"))}
                    onChange={(e) => update(row.key, { group: e.target.value as CategoryLabelKey | "" })}
                    className="w-36 border border-borda rounded-lg px-2 py-1.5 text-sm text-texto bg-card cursor-pointer"
                  >
                    <option value="">{t("trade.newAnimals.choose")}</option>
                    {CATEGORY_LABEL_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {labelOfKey(key)}
                      </option>
                    ))}
                  </select>
                </label>
                {isMale && (
                  <label className="flex items-center gap-1.5 text-sm text-texto pb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.castrated}
                      aria-label={label(t("animal.form.castrated"))}
                      onChange={(e) => update(row.key, { castrated: e.target.checked })}
                    />
                    {t("animal.form.castrated")}
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs text-texto-suave">
                  {t("trade.newAnimals.breed")}
                  <input
                    value={row.breed}
                    maxLength={100}
                    aria-label={label(t("trade.newAnimals.breed"))}
                    onChange={(e) => update(row.key, { breed: e.target.value })}
                    className="w-32 border border-borda rounded-lg px-2 py-1.5 text-sm text-texto"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((other) => other.key !== row.key))}
                  title={t("trade.newAnimals.removeRow", { number: index + 1 })}
                  aria-label={t("trade.newAnimals.removeRow", { number: index + 1 })}
                  className="ml-auto text-texto-leve hover:text-alerta cursor-pointer p-1.5"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {problem && (
                <p role="alert" className="text-xs text-alerta mt-1">
                  {problem}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...rows, blank()])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto text-sm cursor-pointer"
        >
          <Plus size={15} aria-hidden="true" /> {t("trade.newAnimals.addRow")}
        </button>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => onChange([...rows, copyOfLast()])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto text-sm cursor-pointer disabled:opacity-50"
        >
          <Copy size={15} aria-hidden="true" /> {t("trade.newAnimals.repeatLast")}
        </button>
        <span className="flex items-center gap-1.5 text-sm text-texto-suave">
          <input
            type="number"
            min={1}
            max={MAX_ADD_AT_ONCE}
            value={howMany}
            aria-label={t("trade.newAnimals.howMany")}
            onChange={(e) => setHowMany(e.target.value)}
            className="w-16 border border-borda rounded-lg px-2 py-1.5 text-texto"
          />
          <button type="button" onClick={addMany} className="text-verde font-medium cursor-pointer">
            {t("trade.newAnimals.addMany")}
          </button>
        </span>
      </div>
    </div>
  );
}
