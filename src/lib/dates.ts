// Datas de calendário (nascimento, pesagem, aplicação, compra, venda...).
//
// Elas trafegam como texto "AAAA-MM-DD" e são gravadas como meia-noite UTC.
// "Hoje", "futuro" e "vencido" são decididos no FUSO DA FAZENDA (D-16): às 22h
// de 11/10 em Brasília já é 12/10 em UTC, e comparar com o relógio UTC
// aceitava a data de amanhã (F-04).
//
// Enquanto a fazenda não tem cadastro próprio (parte G1), vale o padrão D-16.
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Dia de calendário de "agora" no fuso informado, como "AAAA-MM-DD".
export function todayInTimeZone(
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// "AAAA-MM-DD" de uma data de calendário gravada no banco (meia-noite UTC).
export function calendarDateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Soma dias a uma data de calendário, sem depender de fuso.
export function addDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return calendarDateOf(result);
}

// A data não está no futuro (no fuso da fazenda)?
// Strings "AAAA-MM-DD" podem ser comparadas diretamente em ordem alfabética.
export function isNotInFuture(
  calendarDate: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): boolean {
  return calendarDate <= todayInTimeZone(timeZone, now);
}

// Converte "AAAA-MM-DD" para o Date gravado no banco (meia-noite UTC).
export function toDbDate(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}
