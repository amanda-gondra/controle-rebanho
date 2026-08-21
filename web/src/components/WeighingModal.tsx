import { useState } from "react";
import { X } from "lucide-react";
import { createWeighing } from "../services/animals.js";

type Props = {
  animalId: string;
  animalTag: string;
  onClose: () => void; // fechar sem salvar
  onSaved: () => void; // salvou com sucesso
};

export function WeighingModal({ animalId, animalTag, onClose, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError("");
    if (!date) return setError("Informe a data da pesagem.");
    const weightNumber = Number(weight.replace(",", "."));
    if (!weight || weightNumber <= 0)
      return setError("Informe um peso maior que zero.");

    setSaving(true);
    try {
      await createWeighing(animalId, { date, weightKg: weightNumber });
      onSaved();
    } catch (err: any) {
      setError(err?.message ?? "Algo deu errado. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    // fundo escurecido: clicar nele fecha
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      {/* a janela: clicar dentro NÃO fecha (stopPropagation) */}
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-medium text-texto">Registrar pesagem</h2>
          <button
            onClick={onClose}
            title="Fechar"
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-texto-suave mb-4">Animal {animalTag}</p>

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
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        {error && <p className="text-sm text-alerta mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar pesagem"}
          </button>
        </div>
      </div>
    </div>
  );
}