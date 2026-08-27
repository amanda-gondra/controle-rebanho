import { useState } from "react";
import { X } from "lucide-react";
import { updateWeighing } from "../services/animals.js";
import type { Weighing } from "../types/animal.js";

type Props = {
  animalId: string;
  weighing: Weighing;
  onClose: () => void;
  onSaved: () => void;
};

export function EditWeighingModal({
  animalId,
  weighing,
  onClose,
  onSaved,
}: Props) {
  // já começa preenchido com os valores atuais da pesagem
  const [date, setDate] = useState(weighing.date.slice(0, 10));
  const [weight, setWeight] = useState(String(weighing.weightKg).replace(".", ","));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date) return setError("Informe a data da pesagem.");
    const weightNumber = Number(weight.replace(",", "."));
    if (!weight || weightNumber <= 0)
      return setError("Informe um peso maior que zero.");

    setSaving(true);
    try {
      await updateWeighing(animalId, weighing.id, {
        date,
        weightKg: weightNumber,
      });
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
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-medium text-texto">Editar pesagem</h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Data <span className="text-alerta">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Peso (kg) <span className="text-alerta">*</span>
            </label>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Ex.: 320"
              autoFocus
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
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
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}