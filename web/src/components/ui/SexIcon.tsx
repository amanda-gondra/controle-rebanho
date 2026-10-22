import { Mars, Venus } from "lucide-react";
import type { Sex } from "../../types/animal.js";
import { sexIconStyle } from "../../types/labels.js";

// Símbolo do sexo (decorativo: o texto "Macho"/"Fêmea" sempre vem junto)
export function SexIcon({ sex, size = 16 }: { sex: Sex; size?: number }) {
  const Icon = sex === "MALE" ? Mars : Venus;
  return <Icon size={size} aria-hidden="true" className={sexIconStyle[sex]} />;
}
