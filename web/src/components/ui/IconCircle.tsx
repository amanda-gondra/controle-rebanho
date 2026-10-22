import type { ReactNode } from "react";

// Ícone dentro de um círculo verde-claro (cartões, títulos de seção, estados vazios)
export function IconCircle({ children, size = "md", tone = "green" }: { children: ReactNode; size?: "sm" | "md" | "lg"; tone?: "green" | "neutral" | "alert" }) {
  const dims = size === "sm" ? "w-9 h-9" : size === "lg" ? "w-14 h-14" : "w-12 h-12";
  const colors =
    tone === "alert" ? "bg-[#FBEEEA] text-alerta" : tone === "neutral" ? "bg-bege text-texto-suave" : "bg-verde-claro text-verde";
  return (
    <span aria-hidden="true" className={`flex items-center justify-center rounded-full shrink-0 ${dims} ${colors}`}>
      {children}
    </span>
  );
}
