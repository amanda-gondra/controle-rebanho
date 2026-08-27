import { useState } from "react";
import { X } from "lucide-react";
import { deleteAnimal } from "../services/animals.js";

type Props = {
  animalId: string;
  animalTag: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteModal({ animalId, animalTag, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await deleteAnimal(animalId);
      onDeleted();
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível excluir. Tente de novo.");
      setDeleting(false);
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
          <h2 className="text-lg font-medium text-texto">Excluir animal?</h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-texto-suave mb-5">
          Tem certeza que quer excluir o {animalTag}? Isso apaga o animal e todas
          as pesagens dele, e não dá para desfazer.
        </p>

        <form onSubmit={handleDelete}>
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
              disabled={deleting}
              className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}