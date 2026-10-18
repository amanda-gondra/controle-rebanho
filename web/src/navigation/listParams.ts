// Filtros, busca e página das listas guardados NO ENDEREÇO (?status=ACTIVE&page=2).
// Assim, abrir um animal e voltar devolve a lista exatamente como estava,
// e o endereço pode ser favoritado ou compartilhado. Valores desconhecidos
// voltam ao padrão (nunca quebram a tela). Testado em listParams.test.ts.

type Reader = { get(name: string): string | null };

export function readChoice<T extends string>(params: Reader, name: string, allowed: readonly T[], fallback: T): T {
  const value = params.get(name);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function readPage(params: Reader, name = "page"): number {
  const value = Number(params.get(name));
  return Number.isInteger(value) && value >= 1 && value <= 100_000 ? value : 1;
}

export function readText(params: Reader, name: string, max = 100): string {
  return (params.get(name) ?? "").slice(0, max);
}

// Monta os parâmetros sem os valores padrão (endereço curto e limpo)
export function buildParams(values: Record<string, string | number | boolean | null | undefined>, defaults: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "" || value === defaults[key]) continue;
    params.set(key, String(value));
  }
  return params;
}

// Páginas mostradas na paginação: a primeira, a última e as vizinhas da atual,
// com "…" (null) no meio — nunca uma fileira de 100 botões.
export function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push(null);
    result.push(page);
  });
  return result;
}
