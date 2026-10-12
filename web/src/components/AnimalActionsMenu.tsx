import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

// Menu de ações (três pontinhos) de uma linha da tabela.
// Renderizado via portal no <body> e posicionado por coordenadas do botão,
// pra não ser cortado pelo overflow da tabela.
export function AnimalActionsMenu({ onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;

    // ancora o menu logo abaixo do botão, alinhado à direita
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });

    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // rolar ou redimensionar "desgruda" o menu do botão → fecha
    function onReflow() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // não abre a ficha do animal
          setOpen((v) => !v);
        }}
        title="Ações"
        aria-haspopup="menu"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-texto-leve hover:bg-bege hover:text-texto cursor-pointer"
      >
        <MoreVertical size={18} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="w-40 bg-card border border-borda rounded-xl shadow-lg py-1 z-50"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-texto hover:bg-bege cursor-pointer"
            >
              <Pencil size={15} /> Editar
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-alerta hover:bg-bege cursor-pointer"
            >
              <Trash2 size={15} /> Excluir
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
