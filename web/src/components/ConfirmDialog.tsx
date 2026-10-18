import type { ReactNode } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { t } from "../i18n/index.js";
import { buttonClass } from "./buttonStyles.js";

// Janela de confirmação (desfazer negociação, tirar animal, confirmar venda,
// descartar alterações). O texto diz SEMPRE o que vai acontecer e com quantos
// animais. "Cancelar" nunca executa nada.

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busyLabel: string;
  busy: boolean;
  danger?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy,
  danger,
  error,
  onConfirm,
  onClose,
}: Props) {
  return (
    <ModalFrame title={title} onClose={onClose} busy={busy}>
      <div className="text-sm text-texto-suave mb-5 flex flex-col gap-2">{children}</div>
      {error && (
        <p role="alert" className="text-sm text-alerta mb-4">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>
          {cancelLabel ?? t("common.cancel")}
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className={buttonClass(danger ? "danger" : "primary")}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </ModalFrame>
  );
}
