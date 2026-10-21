// Navegação do Rebanho — regras puras (testadas em origin.test.ts).
//
// Padrão de "voltar" (auditoria de interface, 2026-10-18):
// - Quem abre uma tela de DENTRO do sistema deixa na navegação a marca de
//   onde veio (`state.from`, ex.: "/?status=ACTIVE&page=2").
// - Voltar, cancelar e "depois de salvar" usam essa origem: a pessoa volta
//   exatamente para a tela anterior, com os filtros dela.
// - Sem origem (link colado, página recarregada em outra aba, favorito), o
//   destino é FIXO e seguro, definido por cada tela (ex.: a lista do módulo).
//   Nunca se usa o histórico do navegador às cegas: ele pode levar para fora.

export type OriginState = { from?: unknown } | null | undefined;

// Só caminhos DESTE sistema: começam com "/", sem "//" nem "\" (que o navegador
// trataria como outro site) e nunca as telas públicas de entrar/criar conta.
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2000) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/^\/(login|register)(\/|\?|$)/.test(value)) return null;
  return value;
}

export function originFrom(state: OriginState): string | null {
  return state && typeof state === "object" ? safeInternalPath(state.from) : null;
}

export const pathWithSearch = (location: { pathname: string; search: string }) =>
  `${location.pathname}${location.search}`;

// Item do menu que fica marcado em cada endereço (seção do sistema)
export type Section = "dashboard" | "herd" | "addAnimal" | "lots" | "sanitary" | "trades" | "settings";

export function sectionOf(pathname: string): Section | null {
  if (pathname === "/animais/novo") return "addAnimal";
  if (pathname === "/" || pathname.startsWith("/animais/") || pathname === "/pesagens") return "herd";
  if (pathname === "/painel") return "dashboard";
  if (/^\/lotes(\/|$)/.test(pathname)) return "lots";
  if (/^\/(manejo|produtos|aplicacoes)(\/|$)/.test(pathname)) return "sanitary";
  if (/^\/negociacoes(\/|$)/.test(pathname)) return "trades";
  if (/^\/configuracoes(\/|$)/.test(pathname)) return "settings";
  return null;
}
