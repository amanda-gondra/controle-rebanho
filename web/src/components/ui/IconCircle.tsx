import type { ReactNode } from "react";
import { TONE_CIRCLE, type Tone } from "./tones.js";

// Ícone dentro de um círculo colorido pelo significado (ver tones.ts)
export function IconCircle({ children, size = "md", tone = "herd" }: { children: ReactNode; size?: "sm" | "md" | "lg"; tone?: Tone }) {
  const dims = size === "sm" ? "w-9 h-9" : size === "lg" ? "w-14 h-14" : "w-12 h-12";
  return (
    <span aria-hidden="true" className={`flex items-center justify-center rounded-full shrink-0 ${dims} ${TONE_CIRCLE[tone]}`}>
      {children}
    </span>
  );
}
