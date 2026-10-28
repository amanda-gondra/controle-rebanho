import { useId } from "react";
import type { AnimalOrigin } from "../types/animal.js";
import { originText } from "../types/history.js";
import { t } from "../i18n/index.js";

// Origem e entrada do animal (D-52) — opcionais: "Não informado" é uma
// resposta válida. "Comprado" não aparece: a compra registrada em
// Negociações preenche sozinha (origem + data da compra).

export type EditableOrigin = Exclude<AnimalOrigin, "PURCHASED">;
const OPTIONS: EditableOrigin[] = ["NOT_INFORMED", "BORN_ON_FARM", "RECEIVED"];

type Props = {
  origin: AnimalOrigin;
  entryDate: string;
  onOriginChange: (origin: EditableOrigin) => void;
  onEntryDateChange: (date: string) => void;
  error?: string;
  max: string; // hoje no fuso da fazenda
  // Com compra registrada, só leitura
  fromPurchase?: { entryDate: string | null };
};

export function OriginFields({ origin, entryDate, onOriginChange, onEntryDateChange, error, max, fromPurchase }: Props) {
  const id = useId();

  if (fromPurchase) {
    return (
      <div className="mb-5">
        <p className="block font-medium text-texto mb-1">{t("animal.form.origin")}</p>
        <p className="text-texto">{originText("PURCHASED", fromPurchase.entryDate)}</p>
        <p className="text-sm text-texto-leve mt-1">{t("animal.form.originFromPurchase")}</p>
      </div>
    );
  }

  return (
    <div className="mb-5 grid gap-x-6 gap-y-3 md:grid-cols-2">
      <fieldset>
        <legend className="block font-medium text-texto mb-1">
          {t("animal.form.origin")} <span className="text-texto-leve font-normal">{t("common.optional")}</span>
        </legend>
        <div className="flex flex-wrap gap-2 mb-2">
          {OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={origin === value}
              onClick={() => onOriginChange(value)}
              className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                origin === value ? "bg-verde-claro border-verde text-verde-escuro" : "bg-card border-borda-chip text-texto-suave"
              }`}
            >
              {t(`animal.origin.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-texto-leve">{t("animal.form.originPurchaseHint")}</p>
      </fieldset>
      <div>
        <label htmlFor={`${id}-entry`} className="block text-sm text-texto-suave mb-1">
          {origin === "BORN_ON_FARM" ? t("animal.form.entryDateBorn") : t("animal.form.entryDate")}{" "}
          <span className="text-texto-leve">{t("common.optional")}</span>
        </label>
        <input
          id={`${id}-entry`}
          type="date"
          value={entryDate}
          max={max}
          onChange={(e) => onEntryDateChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full border rounded-lg px-3 py-2 text-texto ${error ? "border-alerta" : "border-borda"}`}
        />
        {error && (
          <p id={`${id}-error`} className="text-sm text-alerta mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
