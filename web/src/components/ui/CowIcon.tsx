// Símbolo do gado usado desde a v1 (a cabeça de vaca com brinco de
// web/public/logo.png). Vira máscara: pega a cor do texto em volta
// (currentColor), então funciona em qualquer cor de significado.
export function CowIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: Math.round((size * 117) / 149),
        WebkitMaskImage: "url(/logo.png)",
        maskImage: "url(/logo.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
