import { useId, type ReactNode } from "react";

// Parte numerada de um formulário longo (cadastro do animal): número, título,
// explicação curta e os campos. Separa as partes com uma linha.
export function FormSection({ step, title, help, children }: { step: number; title: string; help?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="py-6 first:pt-0 border-b border-borda last:border-b-0">
      <div className="flex items-start gap-3 mb-4">
        <span aria-hidden="true" className="flex items-center justify-center w-7 h-7 rounded-full bg-verde-escuro text-white text-sm font-semibold shrink-0">
          {step}
        </span>
        <div>
          <h2 id={id} className="font-semibold text-texto">
            {title}
          </h2>
          {help && <p className="text-xs text-texto-suave">{help}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
