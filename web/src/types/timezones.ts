// Fusos do Brasil (D-31) com o nome que o produtor reconhece: os estados.
// A lista que a API aceita fica no backend (src/lib/farm.ts); aqui só os nomes.

export const BRAZIL_TIME_ZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Horário de Brasília — DF, GO, MG, ES, RJ, SP, PR, SC e RS",
  "America/Bahia": "Bahia",
  "America/Fortaleza": "Ceará, Maranhão, Piauí, Rio Grande do Norte e Paraíba",
  "America/Recife": "Pernambuco",
  "America/Maceio": "Alagoas e Sergipe",
  "America/Araguaina": "Tocantins",
  "America/Belem": "Pará (leste) e Amapá",
  "America/Santarem": "Pará (oeste)",
  "America/Noronha": "Fernando de Noronha",
  "America/Campo_Grande": "Mato Grosso do Sul",
  "America/Cuiaba": "Mato Grosso",
  "America/Porto_Velho": "Rondônia",
  "America/Boa_Vista": "Roraima",
  "America/Manaus": "Amazonas (maior parte)",
  "America/Eirunepe": "Amazonas (oeste)",
  "America/Rio_Branco": "Acre",
};

// Diferença para o horário universal, calculada pelo navegador (ex.: "UTC−3").
// Calculada na hora (não fixa no código): se o Brasil voltar a ter horário de
// verão, o número acompanha sozinho.
export function utcOffsetLabel(timeZone: string, now: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value; // ex.: "GMT-3"
  if (!part) return "";
  return part.replace("GMT", "UTC").replace("-", "−");
}
