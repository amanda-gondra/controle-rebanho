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

// As cores de cada status (classes do Tailwind, na sua paleta).
export const statusStyle: Record<Status, string> = {
  ACTIVE: "bg-verde-claro text-verde-escuro",
  SOLD: "bg-[#FAEEDA] text-[#854F0B]",
  DEAD: "bg-[#F1EFE8] text-[#444441]",
};