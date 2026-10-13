import type { ReactNode } from "react";
import { t } from "../i18n/index.js";

// Moldura das telas de entrar e criar conta (Briefs 6 e 7): painel verde
// sólido com a marca + formulário num card branco sobre o fundo bege.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bege flex flex-col md:flex-row">
      {/* Painel da marca (cor chapada, sem gradiente) */}
      <aside className="bg-verde text-white px-6 py-8 md:w-5/12 md:min-h-screen md:flex md:flex-col md:justify-center md:px-12">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            className="w-10 h-10 md:w-12 md:h-12 [filter:brightness(0)_invert(1)]"
          />
          <span className="text-2xl md:text-3xl font-semibold">{t("common.appName")}</span>
        </div>
        <p className="mt-3 md:mt-6 text-verde-nevoa md:text-lg max-w-sm">
          {t("auth.tagline")}
        </p>
      </aside>

      {/* Formulário */}
      <main className="flex-1 flex items-start md:items-center justify-center p-4 py-8 md:p-12">
        <div className="w-full max-w-md bg-card border border-borda rounded-xl p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// Campo de texto com rótulo e mensagem de erro, ligados por id (acessibilidade)
export function AuthField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-medium text-texto mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-alerta mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (hasError: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-texto bg-card ${
    hasError ? "border-alerta" : "border-borda"
  }`;
