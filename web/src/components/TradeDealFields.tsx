import { useId } from "react";
import type { ArrobaBasis, PriceUnit, TradeType } from "../types/trade.js";
import { t } from "../i18n/index.js";

// Dados da negociação (passo 1 do assistente e topo da correção): data, forma
// de preço (kg, arroba de carcaça, arroba de peso vivo ÷ fator, cabeça),
// comprador/vendedor e observações. O fator começa com o da fazenda e fica
// gravado na negociação (RN-NEG-003).

export type DealDraft = {
  date: string;
  priceUnit: PriceUnit;
  arrobaBasis: ArrobaBasis | null;
  factor: string; // texto digitado ("30")
  counterparty: string;
  notes: string;
};

type Props = {
  type: TradeType;
  value: DealDraft;
  onChange: (patch: Partial<DealDraft>) => void;
  errors: Record<string, string>;
  maxDate: string;
};

const UNITS: PriceUnit[] = ["PER_KG", "PER_ARROBA", "PER_HEAD"];
const BASES: ArrobaBasis[] = ["CARCASS", "LIVE_FACTOR"];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm text-left cursor-pointer ${
        selected ? "bg-verde-claro border-verde text-verde-escuro font-medium" : "bg-card border-borda-chip text-texto-suave"
      }`}
    >
      {children}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-alerta mt-1">
      {message}
    </p>
  ) : null;
}

export function TradeDealFields({ type, value, onChange, errors, maxDate }: Props) {
  const dateId = useId();
  const factorId = useId();
  const counterpartyId = useId();
  const notesId = useId();
  const isSale = type === "SALE";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={dateId} className="block font-medium text-texto mb-1">
          {t(isSale ? "trade.dateSALE" : "trade.datePURCHASE")} <span className="text-alerta">*</span>
        </label>
        <input
          id={dateId}
          type="date"
          value={value.date}
          max={maxDate}
          onChange={(e) => onChange({ date: e.target.value })}
          aria-invalid={!!errors.date}
          className={`border rounded-lg px-3 py-2 text-texto ${errors.date ? "border-alerta" : "border-borda"}`}
        />
        <FieldError message={errors.date} />
      </div>

      <fieldset>
        <legend className="block font-medium text-texto mb-1">{t("trade.priceForm")}</legend>
        <div role="radiogroup" aria-label={t("trade.priceForm")} className="flex flex-wrap gap-2">
          {UNITS.map((unit) => (
            <Choice key={unit} selected={value.priceUnit === unit} onClick={() => onChange({ priceUnit: unit })}>
              {t(`trade.choice${unit}`)}
            </Choice>
          ))}
        </div>
        <FieldError message={errors.priceUnit} />
      </fieldset>

      {value.priceUnit === "PER_ARROBA" && (
        <fieldset>
          <legend className="block font-medium text-texto mb-1">
            {t("trade.arrobaBasis")} <span className="text-alerta">*</span>
          </legend>
          <div role="radiogroup" aria-label={t("trade.arrobaBasis")} className="flex flex-col sm:flex-row gap-2">
            {BASES.map((basis) => (
              <Choice key={basis} selected={value.arrobaBasis === basis} onClick={() => onChange({ arrobaBasis: basis })}>
                {t(`trade.basis${basis}`)}
              </Choice>
            ))}
          </div>
          <FieldError message={errors.arrobaBasis} />
          {value.arrobaBasis === "CARCASS" && (
            <p className="text-xs text-texto-leve mt-1">{t("trade.carcassHint")}</p>
          )}
        </fieldset>
      )}

      {value.priceUnit === "PER_ARROBA" && value.arrobaBasis === "LIVE_FACTOR" && (
        <div>
          <label htmlFor={factorId} className="block font-medium text-texto mb-1">
            {t("trade.factor")}
          </label>
          <input
            id={factorId}
            inputMode="decimal"
            value={value.factor}
            onChange={(e) => onChange({ factor: e.target.value })}
            aria-invalid={!!errors.arrobaFactorKg}
            className={`w-28 border rounded-lg px-3 py-2 text-texto ${errors.arrobaFactorKg ? "border-alerta" : "border-borda"}`}
          />
          <p className="text-xs text-texto-leve mt-1">{t("trade.factorHelp")}</p>
          <FieldError message={errors.arrobaFactorKg} />
        </div>
      )}

      <div>
        <label htmlFor={counterpartyId} className="block font-medium text-texto mb-1">
          {t(isSale ? "trade.buyer" : "trade.seller")}{" "}
          <span className="text-texto-leve font-normal">{t("common.optional")}</span>
        </label>
        <input
          id={counterpartyId}
          value={value.counterparty}
          maxLength={100}
          onChange={(e) => onChange({ counterparty: e.target.value })}
          className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
        />
        <FieldError message={errors.counterparty} />
      </div>

      <div>
        <label htmlFor={notesId} className="block font-medium text-texto mb-1">
          {t("trade.notes")} <span className="text-texto-leve font-normal">{t("common.optional")}</span>
        </label>
        <textarea
          id={notesId}
          value={value.notes}
          maxLength={1000}
          rows={2}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
        />
        <FieldError message={errors.notes} />
      </div>
    </div>
  );
}
