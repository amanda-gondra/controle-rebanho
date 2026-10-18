import { RotateCcw } from "lucide-react";
import { t } from "../i18n/index.js";
import { buttonClass } from "./buttonStyles.js";

// Falha ao carregar (regra transversal 9): diz o que aconteceu e oferece
// "Tentar de novo". Nunca deixa a tela vazia como se não houvesse dados.
export function LoadError({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  return (
    <div
      role="alert"
      className={`bg-card border border-borda rounded-xl ${compact ? "p-4" : "p-6"} flex flex-wrap items-center justify-between gap-3`}
    >
      <p className="text-texto">{message}</p>
      <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
        <RotateCcw size={16} aria-hidden="true" /> {t("common.retry")}
      </button>
    </div>
  );
}
