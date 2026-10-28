import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "../i18n/index.js";

// Janela padrão do sistema (auditoria de interface, 2026-10-18): fundo escuro,
// anunciada como janela para leitor de tela, foco vai para dentro ao abrir e
// volta ao botão que abriu ao fechar, Esc e clique fora fecham.
// Com `dirty` (algo digitado), Esc e clique fora NÃO fecham — para não perder o
// que foi digitado sem querer; fechar só pelo "Cancelar" ou pelo X, que são
// decisões explícitas.

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  busy?: boolean; // gravando: nada fecha
  size?: "md" | "lg";
  children: ReactNode;
};

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function ModalFrame({ title, subtitle, onClose, dirty = false, busy = false, size = "md", children }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const canDismiss = !dirty && !busy;
  const dismissRef = useRef({ canDismiss, onClose });
  dismissRef.current = { canDismiss, onClose };

  // Foco para dentro ao abrir (primeiro campo; se não houver, o painel) e de
  // volta para quem abriu ao fechar
  // Quem abriu é guardado já na 1ª renderização (antes de o foco entrar na janela)
  const opener = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const node = panel.current;
    const autofocus = node?.querySelector<HTMLElement>("[autofocus]");
    const first = autofocus ?? node?.querySelector<HTMLElement>(`form ${FOCUSABLE}`) ?? node;
    first?.focus();
    const previous = opener.current;
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissRef.current.canDismiss) {
        event.stopPropagation();
        dismissRef.current.onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canDismiss) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-card rounded-2xl p-6 w-full ${size === "lg" ? "max-w-xl" : "max-w-md"} max-h-[90vh] overflow-y-auto focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 id={titleId} className="text-lg font-medium text-texto">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="text-texto-leve hover:text-texto cursor-pointer p-1 -m-1 rounded-lg disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>
        {subtitle && <div className="text-sm text-texto-suave mb-4">{subtitle}</div>}
        {!subtitle && <div className="mb-3" />}
        {children}
      </div>
    </div>
  );
}
