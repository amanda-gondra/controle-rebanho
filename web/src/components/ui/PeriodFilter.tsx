import { useId } from "react";
import { CalendarDays } from "lucide-react";
import { t } from "../../i18n/index.js";
import { PERIOD_PRESETS, presetOf, presetPeriod } from "../../types/dashboard.js";

export type Period = { from: string; to: string } | null; // null = todo o período

// Escolha do período de uma lista: atalhos + "De/Até". `null` = sem limite.
// Quem usa guarda o período no endereço.
export function PeriodFilter({ period, today, onChange }: { period: Period; today: string; onChange: (period: Period) => void }) {
  const id = useId();
  const active = period ? presetOf(period, today) : "all";
  const options = ["all", ...PERIOD_PRESETS] as const;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={`${id}-preset`} className="text-sm text-texto-suave">
        <span className="block mb-1">{t("period.label")}</span>
        <span className="relative block">
          <CalendarDays size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve pointer-events-none" />
          <select
            id={`${id}-preset`}
            value={active ?? "custom"}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "all") onChange(null);
              else if (value !== "custom") onChange(presetPeriod(value as (typeof PERIOD_PRESETS)[number], today));
            }}
            className="border border-borda rounded-lg pl-9 pr-3 py-2 bg-card text-texto cursor-pointer"
          >
            {options.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? t("period.all") : t(`dashboard.preset.${value}`)}
              </option>
            ))}
            {active === null && <option value="custom">{t("period.custom")}</option>}
          </select>
        </span>
      </label>
      <label htmlFor={`${id}-from`} className="text-sm text-texto-suave">
        <span className="block mb-1">{t("dashboard.from")}</span>
        <input
          id={`${id}-from`}
          type="date"
          max={period?.to ?? today}
          value={period?.from ?? ""}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: period?.to ?? today })}
          className="border border-borda rounded-lg px-3 py-2 bg-card text-texto"
        />
      </label>
      <label htmlFor={`${id}-to`} className="text-sm text-texto-suave">
        <span className="block mb-1">{t("dashboard.to")}</span>
        <input
          id={`${id}-to`}
          type="date"
          min={period?.from}
          max={today}
          value={period?.to ?? ""}
          onChange={(e) => e.target.value && onChange({ from: period?.from ?? e.target.value, to: e.target.value })}
          className="border border-borda rounded-lg px-3 py-2 bg-card text-texto"
        />
      </label>
    </div>
  );
}
