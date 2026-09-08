import type { BirthPrecision } from "./animal.js";

// Formata uma data ISO ("2023-03-15" ou "2023-03-15T00:00:00.000Z") para "15/03/2023".
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Formata um número para o padrão brasileiro (300 → "300", 180.5 → "180,5").
export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

// Formata um valor em reais (1234.5 → "R$ 1.234,50", -560 → "-R$ 560,00").
export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Idade exata a partir da data de nascimento, para a coluna "Animal" da lista.
// Ex.: "2 anos e 3 meses", "8 meses", "1 ano". A precisão do nascimento varia:
// quando é só mês/ano, o birthDate já vem salvo com o dia 1 — como só mostramos
// anos e meses, a conta funciona igual. Sem data ou precisão desconhecida
// → texto neutro.
export function formatAge(
  birthDate: string | null,
  precision: BirthPrecision,
): string {
  if (!birthDate || precision === "UNKNOWN") {
    return "Idade não informada";
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
    return "menos de 1 mês";
  }

  const parts: string[] = [];
  if (years > 0) parts.push(years === 1 ? "1 ano" : `${years} anos`);
  if (months > 0) parts.push(months === 1 ? "1 mês" : `${months} meses`);
  return parts.join(" e ");
}
