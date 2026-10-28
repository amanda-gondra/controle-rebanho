import type { ReactNode } from "react";
import { t } from "../i18n/index.js";

// Moldura das telas de entrar e criar conta (Briefs 6 e 7): painel escuro
// (o mesmo do menu) com a logo oficial + formulário num card branco sobre o fundo bege.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bege flex flex-col md:flex-row">
      {/* Painel da marca (cor chapada, sem gradiente) */}
      <aside className="bg-sidebar text-white px-6 py-8 md:w-5/12 md:min-h-screen md:flex md:flex-col md:justify-center md:items-start md:px-12">
        {/* Logo oficial completa (versão para fundo escuro) */}
        <img
          src="/brand/camporico-full-dark.png"
          alt={t("brand.name")}
          className="w-44 md:w-72 h-auto"
        />
        <p className="mt-4 md:mt-8 text-verde-nevoa md:text-lg max-w-sm">
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
