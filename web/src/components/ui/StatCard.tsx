import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { IconCircle } from "./IconCircle.js";
import { useOriginState } from "../../navigation/hooks.js";

// Cartão de indicador (padrão das telas novas): ícone no círculo, rótulo,
// número grande, linha de detalhe (no celular: sem o ícone, dois por linha) e, se houver, a explicação da regra.
// Com `to`, o cartão inteiro abre a lista que explica o número.
type Props = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  rule?: string;
  to?: string;
  linkLabel?: string; // texto do link (para leitor de tela e, se `showLink`, visível)
  showLink?: boolean;
  tone?: "normal" | "attention";
};

export function StatCard({ icon, label, value, detail, rule, to, linkLabel, showLink = false, tone = "normal" }: Props) {
  const originState = useOriginState();
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="max-sm:hidden">
          <IconCircle tone={tone === "attention" ? "alert" : "green"}>{icon}</IconCircle>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-texto-suave">{label}</p>
          <p className="text-xl sm:text-2xl font-semibold text-texto leading-tight mt-1 break-words sm:whitespace-nowrap">{value}</p>
        </div>
        {to && <ChevronRight size={18} aria-hidden="true" className="text-texto-leve shrink-0 mt-0.5" />}
      </div>
      {detail && <p className="text-xs sm:text-sm text-texto mt-2">{detail}</p>}
      {rule && <p className="text-xs text-texto-leve mt-2">{rule}</p>}
      {to && showLink && linkLabel && (
        <span className="mt-3 inline-flex items-center gap-1 text-sm text-verde font-medium">
          {linkLabel}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </>
  );
  const frame = `bg-card border rounded-xl p-4 sm:p-5 flex flex-col shadow-[0_1px_2px_rgba(44,42,36,0.04)] ${
    tone === "attention" ? "border-[#E7C3B8]" : "border-borda"
  }`;
  return to ? (
    <Link
      to={to}
      state={originState}
      aria-label={linkLabel ? `${label}: ${linkLabel}` : undefined}
      className={`${frame} hover:border-verde-nevoa transition-colors`}
    >
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}
