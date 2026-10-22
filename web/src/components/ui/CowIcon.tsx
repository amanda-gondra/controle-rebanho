// Ícone de cabeça de boi (traço), no mesmo estilo dos ícones lucide do sistema.
// Desenho próprio e genérico — não é a logo.
export function CowIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 6c-1.5 0-3 .8-3 2.2C2 9.5 3.4 10 5 10" />
      <path d="M19 6c1.5 0 3 .8 3 2.2 0 1.3-1.4 1.8-3 1.8" />
      <path d="M7 4.5C8.5 3.5 10.2 3 12 3s3.5.5 5 1.5" />
      <path d="M6 6.5c0 3 .5 6 1.5 8.5.6 1.5 1.5 2.5 2 4 .4 1.2 1.3 2 2.5 2s2.1-.8 2.5-2c.5-1.5 1.4-2.5 2-4 1-2.5 1.5-5.5 1.5-8.5" />
      <path d="M10 17.5h.01M14 17.5h.01" />
      <path d="M9.5 10.5h.01M14.5 10.5h.01" />
    </svg>
  );
}
