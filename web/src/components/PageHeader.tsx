import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useOrigin } from "../navigation/hooks.js";
import { t } from "../i18n/index.js";

// Cabeçalho padrão das telas: (voltar) + título + descrição + ações à direita.
// O "voltar" segue o padrão do sistema (navigation/origin.ts): volta para a
// tela que abriu esta, com os filtros dela; aberta por link direto, vai para
// `backFallback`. Telas principais do menu não têm "voltar".

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  backFallback?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode; // linha extra sob o título (ex.: selo de situação)
};

export function BackButton({ fallback, label }: { fallback: string; label?: string }) {
  const { goBack } = useOrigin(fallback);
  const text = label ?? t("common.back");
  return (
    <button
      type="button"
      onClick={goBack}
      title={text}
      aria-label={text}
      className="text-texto-suave hover:text-texto cursor-pointer p-1 -m-1 mt-0.5 rounded-lg shrink-0"
    >
      <ArrowLeft size={22} />
    </button>
  );
}

export function PageHeader({ title, subtitle, backFallback, backLabel, actions, children }: Props) {
  return (
    <div className="flex flex-wrap items-start gap-3 mb-6">
      {backFallback && <BackButton fallback={backFallback} label={backLabel} />}
      <div className="flex-1 min-w-[12rem]">
        <h1 className="text-2xl font-semibold text-texto">{title}</h1>
        {subtitle && <p className="text-texto-suave">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
