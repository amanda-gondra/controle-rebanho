import type { AnimalOrigin, Category, Sex } from "./animal.js";

// Painel mínimo (D-50) — o que GET /dashboard devolve. A regra de cada número
// está em docs/architecture.md ("Painel") e na própria tela.
export type Dashboard = {
  period: { from: string; to: string };
  today: string;
  herd: {
    active: number;
    byCategory: { category: Category; sex: Sex; count: number }[];
    byLot: { lotId: string; name: string; count: number }[];
    withoutLot: number;
  };
  movements: {
    entries: Partial<Record<AnimalOrigin, number>>;
    entriesTotal: number;
    sold: number;
    died: number;
  };
  reminders: { overdue: number; upcoming: number; alertDays: number };
  weighings: {
    inPeriod: number;
    animalsWeighed: number;
    recent: { id: string; date: string; weightKg: string; animal: { id: string; tag: string } }[];
  };
  gain: { averageDailyGainKg: number | null; animalsWithGain: number; animalsWithoutGain: number };
};

// Atalhos de período (o painel também aceita datas livres)
export type PeriodPreset = "thisMonth" | "lastMonth" | "last30" | "thisYear";
export const PERIOD_PRESETS: PeriodPreset[] = ["thisMonth", "lastMonth", "last30", "thisYear"];

const pad = (value: number) => String(value).padStart(2, "0");
const iso = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

// Datas "AAAA-MM-DD" de cada atalho a partir de "hoje" (fuso da fazenda)
export function presetPeriod(preset: PeriodPreset, today: string): { from: string; to: string } {
  const [year, month, day] = today.split("-").map(Number);
  switch (preset) {
    case "thisMonth":
      return { from: `${year}-${pad(month)}-01`, to: today };
    case "lastMonth": {
      const first = new Date(Date.UTC(year, month - 2, 1));
      const last = new Date(Date.UTC(year, month - 1, 0));
      return { from: iso(first), to: iso(last) };
    }
    case "last30":
      return { from: iso(new Date(Date.UTC(year, month - 1, day - 29))), to: today };
    case "thisYear":
      return { from: `${year}-01-01`, to: today };
  }
}

export function presetOf(period: { from: string; to: string }, today: string): PeriodPreset | null {
  return PERIOD_PRESETS.find((preset) => {
    const candidate = presetPeriod(preset, today);
    return candidate.from === period.from && candidate.to === period.to;
  }) ?? null;
}
