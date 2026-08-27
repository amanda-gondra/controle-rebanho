import { useState } from "react";
import { X } from "lucide-react";
import { updateStatus } from "../services/animals.js";
import type { Status } from "../types/animal.js";

type Props = {
  animalId: string;
  animalTag: string;
  currentStatus: Status;
  onClose: () => void;
  onSaved: () => void;
};

const options: { value: Status; label: string }[] = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "SOLD", label: "Vendido" },
  { value: "DEAD", label: "Morto" },
];

export function StatusModal({
  animalId,
  animalTag,
  currentStatus,
  onClose,
  onSaved,
}: Props) {
  const [status, setStatus] = useState<Status>(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateStatus(animalId, status);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível mudar o status. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-medium text-texto">
            Mudar status do animal
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-texto-suave mb-4">
          O que aconteceu com o {animalTag}?
        </p>

        <form onSubmit={handleSave}>
          <div className="flex flex-col gap-2 mb-5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`py-2.5 rounded-lg border font-medium cursor-pointer ${
                  status === opt.value
                    ? "bg-verde-claro border-verde text-verde-escuro"
                    : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-alerta mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}