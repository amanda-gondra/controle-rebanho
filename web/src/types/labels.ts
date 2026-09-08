import type { Sex, Category, Status } from "./animal.js";

// Traduz os códigos da API (inglês) para o que aparece na tela (português).
export const sexLabel: Record<Sex, string> = {
  MALE: "Macho",
  FEMALE: "Fêmea",
};

export const categoryLabel: Record<Category, string> = {
  CALF: "Bezerro",
  YEARLING: "Novilho",
  STEER: "Boi",
  COW: "Vaca",
};

export const statusLabel: Record<Status, string> = {
  ACTIVE: "Ativo",
  SOLD: "Vendido",
  DEAD: "Morto",
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
