import type { Sex, Status } from "./animal.js";
import { t } from "../i18n/index.js";

// Traduz os códigos da API (inglês) para o texto da tela (arquivo de tradução — G3).
export const sexLabel: Record<Sex, string> = {
  MALE: t("animal.sex.MALE"),
  FEMALE: t("animal.sex.FEMALE"),
};

// Nomes das categorias: vêm da fazenda (podem ser personalizados) — use o
// hook useCategoryLabels (web/src/hooks/useCategoryLabels.ts).

export const statusLabel: Record<Status, string> = {
  ACTIVE: t("animal.status.ACTIVE"),
  SOLD: t("animal.status.SOLD"),
  DEAD: t("animal.status.DEAD"),
};

// As cores da etiqueta de cada status (fundo + texto).
export const statusStyle: Record<Status, string> = {
  ACTIVE: "bg-verde-claro text-verde-escuro",
  SOLD: "bg-[#FAEEDA] text-[#854F0B]",
  DEAD: "bg-[#F1EFE8] text-[#444441]",
};

// Cor do pontinho de status — usado na etiqueta da lista e na linha de
// contadores do topo. (amarelo vendido / cinza morto acompanham o statusStyle.)
export const statusDotStyle: Record<Status, string> = {
  ACTIVE: "bg-verde",
  SOLD: "bg-[#D8A200]",
  DEAD: "bg-[#9A8F7C]",
};

// Cor do ícone de sexo na lista: azul macho, rosa fêmea (cores pedidas no
// mockup; não fazem parte da paleta do tema).
export const sexIconStyle: Record<Sex, string> = {
  MALE: "text-[#2E7BD6]",
  FEMALE: "text-[#D6478B]",
};
