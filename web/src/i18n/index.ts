import { ptBR } from "./pt-BR.js";

// Textos da interface (G3 — "textos fora do código").
//
// - Todo texto que aparece na tela vem de um arquivo de tradução
//   (`pt-BR.ts`), por uma chave: t("animals.create.title").
// - A 1.0 publica só português (D-01). Existe um idioma de TESTE, só no
//   ambiente de desenvolvimento, que troca cada texto pela própria chave
//   (⟦animals.create.title⟧). Com ele ligado, qualquer frase em português que
//   aparecer na tela ficou fixa no código — é o critério de aceitação da G3.
//   Para ligar: abrir o app com ?lang=test (e ?lang=pt-BR para voltar).
// - Sem biblioteca externa: é uma função pequena, tipada (chave errada não
//   compila) e com plural pelo padrão do navegador (Intl.PluralRules).

type Plural = { one: string; other: string };
type MessageValue = string | Plural;

// Todas as chaves possíveis ("a.b.c"), calculadas a partir do pt-BR
type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | Plural
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof ptBR>;
export type Params = Record<string, string | number>;

export type Locale = "pt-BR" | "test";

const LOCALE_STORAGE_KEY = "rebanho:locale";

// Idioma de teste só existe em desenvolvimento (nunca no app publicado)
function detectLocale(): Locale {
  if (!import.meta.env.DEV || typeof window === "undefined") return "pt-BR";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "test" || fromUrl === "pt-BR") sessionStorage.setItem(LOCALE_STORAGE_KEY, fromUrl);
    return sessionStorage.getItem(LOCALE_STORAGE_KEY) === "test" ? "test" : "pt-BR";
  } catch {
    return "pt-BR";
  }
}

const locale: Locale = detectLocale();

export const getLocale = () => locale;

// Idioma usado para formatar datas e números (Intl). No idioma de teste usa o
// inglês, para provar que nenhuma data ou número foi formatado "na mão".
export const intlLocale = () => (locale === "test" ? "en-US" : "pt-BR");

function lookup(key: string): MessageValue | undefined {
  let current: unknown = ptBR;
  for (const part of key.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" || (current && typeof current === "object" && "other" in current)
    ? (current as MessageValue)
    : undefined;
}

function interpolate(text: string, params?: Params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function t(key: MessageKey, params?: Params): string {
  if (locale === "test") {
    const values = params ? Object.values(params).join(", ") : "";
    return values ? `⟦${key}: ${values}⟧` : `⟦${key}⟧`;
  }

  const value = lookup(key);
  if (value === undefined) return key; // nunca acontece com chave tipada; seguro mesmo assim

  if (typeof value === "string") return interpolate(value, params);

  // Plural: escolhe "one" ou "other" pelo número em params.count. Zero usa
  // "other" ("0 animais"): é como se fala no Brasil, embora a regra padrão do
  // português (CLDR) trate o zero como singular.
  const count = Number(params?.count ?? 0);
  const form =
    count !== 0 && new Intl.PluralRules(intlLocale()).select(count) === "one" ? "one" : "other";
  return interpolate(value[form], params);
}

// Para chaves montadas a partir de um código vindo da API (ex.: o código de
// um erro). Devolve undefined quando não existe tradução para aquele código.
export function tOptional(key: string, params?: Params): string | undefined {
  return lookup(key) === undefined ? undefined : t(key as MessageKey, params);
}
