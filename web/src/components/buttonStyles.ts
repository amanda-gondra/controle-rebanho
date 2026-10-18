// Aparência dos botões de ação (mesma em todas as telas)
export type ButtonVariant = "primary" | "secondary" | "danger" | "dangerOutline";

export function buttonClass(variant: ButtonVariant, extra = "") {
  const base =
    "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-medium cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
  const look: Record<ButtonVariant, string> = {
    primary: "bg-verde text-white hover:bg-verde-escuro",
    secondary: "border border-borda-chip bg-card text-texto-suave hover:bg-bege",
    danger: "bg-alerta text-white",
    dangerOutline: "border border-borda-chip bg-card text-alerta hover:bg-bege",
  };
  return `${base} ${look[variant]} ${extra}`.trim();
}
