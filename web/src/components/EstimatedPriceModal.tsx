import { useState } from "react";
import { X } from "lucide-react";
import { setEstimatedPrice } from "../services/finance.js";

type Props = {
  animalId: string;
  animalTag: string;
  current: string | null; // preço/kg estimado atual (texto) ou null
  onClose: () => void;
  onSaved: () => void;
};

// Modal simples para o produtor informar (ou limpar) o preço/kg estimado
// do animal vivo. Campo vazio = limpar a estimativa.
export function EstimatedPriceModal({
  animalId,
  animalTag,
  current,
  onClose,
  onSaved,
}: Props) {
  const [price, setPrice] = useState(
    current ? String(current).replace(".", ",") : "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = price.trim();
    // vazio → limpa a estimativa (manda null)
    const value = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      return setError("Informe um preço por kg maior que zero.");
    }

    setSaving(true);
    try {
      await setEstimatedPrice(animalId, value);
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Algo deu errado. Tente de novo.");
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
          <h2 className="text-lg font-medium text-texto">Preço estimado</h2>
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
          Animal {animalTag} · preço por kg que você pagaria hoje pelo animal
          vivo. Serve para estimar o resultado enquanto ele não é vendido.
        </p>

        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Preço por kg
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ex.: 11,50"
              autoFocus
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
            <p className="text-xs text-texto-leve mt-1">
              Deixe em branco para remover a estimativa.
            </p>
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
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
