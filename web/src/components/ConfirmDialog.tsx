import type { ReactNode } from "react";
import { t } from "../i18n/index.js";

// Janela de confirmação (desfazer negociação, tirar animal, confirmar venda).
// O texto da pergunta diz SEMPRE o que vai acontecer e com quantos animais.

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  danger?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({ title, children, confirmLabel, busyLabel, busy, danger, error, onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="bg-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-medium text-texto mb-2">
          {title}
        </h2>
        <div className="text-sm text-texto-suave mb-5 flex flex-col gap-2">{children}</div>
        {error && (
          <p role="alert" className="text-sm text-alerta mb-4">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2.5 rounded-xl text-white font-medium cursor-pointer disabled:opacity-60 ${
              danger ? "bg-alerta" : "bg-verde"
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
