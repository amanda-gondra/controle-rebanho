import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { t } from "../../i18n/index.js";

// Menu de ações (três pontinhos) de uma linha de tabela ou cartão.
// Renderizado via portal no <body> e posicionado pelo botão, para não ser
// cortado pelo overflow da tabela. Esc, clique fora, rolar ou redimensionar fecham.
export type MenuAction = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function ActionsMenu({ actions, label }: { actions: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();

    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const text = label ?? t("common.actions");
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((v) => !v);
        }}
        title={text}
        aria-label={text}
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-texto-leve hover:bg-bege hover:text-texto cursor-pointer"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="min-w-48 bg-card border border-borda rounded-xl shadow-lg py-1 z-50"
          >
            {actions.map((action) => (
              <button
                key={action.label}
                role="menuitem"
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bege cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  action.danger ? "text-alerta" : "text-texto"
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
