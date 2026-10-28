import { useId, type ReactNode } from "react";

// Bloco branco com título (e ícone opcional), descrição e ação à direita
type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  padded?: boolean;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, icon, action, className = "", padded = true, children }: Props) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`bg-card border border-borda rounded-xl shadow-[0_1px_2px_rgba(44,42,36,0.04)] ${className}`}
    >
      <div className={`flex items-start justify-between gap-3 ${padded ? "px-5 pt-5" : "px-5 pt-5"} mb-3`}>
        <div className="flex items-start gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 id={id} className="font-semibold text-texto">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-texto-suave mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className={padded ? "px-5 pb-5" : "pb-1"}>{children}</div>
    </section>
  );
}
