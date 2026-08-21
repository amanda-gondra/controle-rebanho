// Formata uma data ISO ("2023-03-15" ou "2023-03-15T00:00:00.000Z") para "15/03/2023".
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Formata um número para o padrão brasileiro (300 → "300", 180.5 → "180,5").
export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}