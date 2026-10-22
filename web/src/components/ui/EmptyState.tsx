import type { ReactNode } from "react";
import { IconCircle } from "./IconCircle.js";

// Estado vazio: ícone, o que falta e (opcional) o que fazer
export function EmptyState({ icon, title, help, action }: { icon: ReactNode; title: string; help?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-6 px-4">
      <IconCircle size="lg" tone="neutral">
        {icon}
      </IconCircle>
      <p className="text-sm text-texto mt-3">{title}</p>
      {help && <p className="text-xs text-texto-suave mt-1 max-w-sm">{help}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
