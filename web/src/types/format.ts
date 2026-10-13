import type { BirthPrecision } from "./animal.js";
import { intlLocale, t } from "../i18n/index.js";

// Formatação de datas, números e dinheiro (G3): sempre pelo padrão de
// internacionalização do navegador (Intl), no idioma da tela — nunca "na mão".

// Moeda da fazenda (D-30: fixa em real na 1.0, mas já vem da conta). O
// AuthProvider avisa qual é assim que a sessão carrega.
let displayCurrency = "BRL";
export function setDisplayCurrency(currency: string) {
  displayCurrency = currency;
}

// Data ISO ("2023-03-15" ou "2023-03-15T00:00:00.000Z") → "15/03/2023".
// As datas de calendário são guardadas à meia-noite UTC; por isso timeZone UTC.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(), { timeZone: "UTC" });
}

// Só mês e ano, por extenso ("março de 2023")
export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString(intlLocale(), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

// Número no padrão do idioma (180.5 → "180,5")
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(intlLocale(), options);
}

// Valor em dinheiro na moeda da fazenda (1234.5 → "R$ 1.234,50")
export function formatMoney(value: number): string {
  return value.toLocaleString(intlLocale(), { style: "currency", currency: displayCurrency });
}

// Idade exata a partir da data de nascimento, para a coluna "Animal" da lista.
// Ex.: "2 anos e 3 meses", "8 meses", "1 ano". Quando a precisão é só mês/ano,
// o birthDate já vem salvo com o dia 1 — como só mostramos anos e meses, a
// conta funciona igual. Sem data ou precisão desconhecida → texto neutro.
export function formatAge(birthDate: string | null, precision: BirthPrecision): string {
  if (!birthDate || precision === "UNKNOWN") {
    return t("age.unknown");
  }

  const born = new Date(birthDate);
  const now = new Date();

  // diferença em anos e meses (em UTC, pra bater com a data salva)
  let years = now.getUTCFullYear() - born.getUTCFullYear();
  let months = now.getUTCMonth() - born.getUTCMonth();
  if (now.getUTCDate() < born.getUTCDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return t("age.lessThanMonth");
  }

  const yearsText = years > 0 ? t("age.years", { count: years }) : "";
  const monthsText = months > 0 ? t("age.months", { count: months }) : "";
  if (yearsText && monthsText) return t("age.yearsAndMonths", { years: yearsText, months: monthsText });
  return yearsText || monthsText;
}

// Nomes dos 12 meses no idioma da tela ("Janeiro"…), pelo Intl
export function monthNames(): string[] {
  const formatter = new Intl.DateTimeFormat(intlLocale(), { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, month) => {
    const name = formatter.format(new Date(Date.UTC(2000, month, 1)));
    return name.charAt(0).toLocaleUpperCase(intlLocale()) + name.slice(1);
  });
}
