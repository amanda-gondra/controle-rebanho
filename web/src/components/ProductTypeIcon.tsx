import { Bug, Pill, Syringe, Stethoscope } from "lucide-react";
import type { ProductType } from "../types/animal.js";

// Ícone do tipo de produto (D-39) — sempre acompanhado do nome do tipo em
// texto na tela (a cor e o ícone não carregam a informação sozinhos)
const STYLE: Record<ProductType, string> = {
  VACCINE: "bg-verde-claro text-verde",
  DEWORMER: "bg-bege text-couro",
  EXTERNAL_PARASITICIDE: "bg-[#F1EFE8] text-couro",
  OTHER: "bg-bege text-texto-suave",
};

export function ProductTypeIcon({ type, size = 16, className = "w-9 h-9" }: { type: ProductType; size?: number; className?: string }) {
  const Icon = type === "VACCINE" ? Syringe : type === "DEWORMER" ? Pill : type === "EXTERNAL_PARASITICIDE" ? Bug : Stethoscope;
  return (
    <span aria-hidden="true" className={`flex items-center justify-center rounded-full shrink-0 ${className} ${STYLE[type]}`}>
      <Icon size={size} />
    </span>
  );
}
