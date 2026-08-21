import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

type Toast = { id: number; message: string };

// O "canal" pelo qual qualquer tela pede pra mostrar um toast.
const ToastContext = createContext<(message: string) => void>(() => {});

// Um hook simples pras telas usarem: const showToast = useToast();
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((list) => [...list, { id, message }]);
    // some sozinho depois de 3 segundos
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  function removeToast(id: number) {
    setToasts((list) => list.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={showToast}>
      {children}

      {/* Os toasts aparecem no canto superior direito */}
      <div className="fixed top-4 right-4 flex flex-col gap-2 z-[100]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-card border border-borda rounded-xl px-4 py-3 shadow-lg min-w-[260px]"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-verde-claro text-verde-escuro">
              <Check size={16} />
            </span>
            <p className="flex-1 text-sm text-texto">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              title="Fechar"
              className="text-texto-leve hover:text-texto cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}