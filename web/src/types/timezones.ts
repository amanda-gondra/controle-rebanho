import { tOptional } from "../i18n/index.js";

// Fusos do Brasil (D-31) com o nome que o produtor reconhece: os estados.
// A lista que a API aceita fica no backend (src/lib/farm.ts); aqui só os nomes.

// Fusos do Brasil na ordem da lista (o nome de cada um vem da tradução:
// timezones.<fuso> — G3).
export const BRAZIL_TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Fortaleza",
  "America/Recife",
  "America/Maceio",
  "America/Araguaina",
  "America/Belem",
  "America/Santarem",
  "America/Noronha",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Manaus",
  "America/Eirunepe",
  "America/Rio_Branco",
] as const;

export const timeZoneLabel = (zone: string) =>
  tOptional(`timezones.${zone}`) ?? zone;

// Diferença para o horário universal, calculada pelo navegador (ex.: "UTC−3").
// Calculada na hora (não fixa no código): se o Brasil voltar a ter horário de
// verão, o número acompanha sozinho.
export function utcOffsetLabel(timeZone: string, now: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }) // só para ler o número; o rótulo UTC é universal
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value; // ex.: "GMT-3"
  if (!part) return "";
  return part.replace("GMT", "UTC").replace("-", "−");
}
