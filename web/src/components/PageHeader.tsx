import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useOrigin } from "../navigation/hooks.js";
import { t } from "../i18n/index.js";
import { TopBarActions } from "./TopBar.js";

// Cabeçalho padrão das telas: (voltar) + título + descrição + ações à direita.
// O "voltar" segue o padrão do sistema (navigation/origin.ts): volta para a
// tela que abriu esta, com os filtros dela; aberta por link direto, vai para
// `backFallback`. Telas principais do menu não têm "voltar".

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  backFallback?: string;
  backLabel?: string; // nome completo para leitor de tela (ex.: "Voltar para os lotes")
  backText?: string; // texto curto visível (ex.: "Lotes"); padrão "Voltar"
  actions?: ReactNode;
  children?: ReactNode; // linha extra sob o título (ex.: selo de situação)
};

export function BackButton({ fallback, label, text }: { fallback: string; label?: string; text?: string }) {
  const { goBack } = useOrigin(fallback);
  const name = label ?? t("common.back");
  return (
    <button
      type="button"
      onClick={goBack}
      title={name}
      aria-label={name}
      className="inline-flex items-center gap-2 text-sm font-medium text-texto hover:text-verde cursor-pointer rounded-lg py-1 -my-1"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {text ?? t("common.back")}
    </button>
  );
}

// Cabeçalho padrão: linha de cima com o "voltar" (à esquerda) e, no
// computador, o sino de lembretes e o menu da conta (à direita); depois o
// título, a descrição e as ações da tela.
export function PageHeader({ title, subtitle, backFallback, backLabel, backText, actions, children }: Props) {
  return (
    <header className="mb-6">
      <div className={`flex items-center justify-between gap-3 ${backFallback ? "mb-3" : "md:mb-3"} ${backFallback ? "" : "max-md:hidden"}`}>
        <div>{backFallback && <BackButton fallback={backFallback} label={backLabel} text={backText} />}</div>
        <TopBarActions />
      </div>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-[26px] md:text-[30px] leading-tight font-semibold tracking-tight text-texto">{title}</h1>
          {subtitle && <p className="text-texto-suave mt-1">{subtitle}</p>}
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
