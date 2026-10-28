import type { ReactNode } from "react";

// Selo de situação com pontinho (a cor nunca é a única informação: o texto vai junto)
const TONES = {
  green: "bg-verde-claro text-verde-escuro",
  amber: "bg-[#FAEEDA] text-[#854F0B]",
  gray: "bg-bege text-texto-suave",
  red: "bg-[#FBEEEA] text-alerta",
  blue: "bg-[#E6EEF8] text-[#28548F]",
} as const;
const DOTS = { green: "bg-verde", amber: "bg-[#D8A200]", gray: "bg-texto-leve", red: "bg-alerta", blue: "bg-[#2E7BD6]" } as const;

export function StatusBadge({ tone, children, dot = true }: { tone: keyof typeof TONES; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${TONES[tone]}`}>
      {dot && <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}
