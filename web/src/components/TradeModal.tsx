import { useState } from "react";
import { X } from "lucide-react";
import {
  createPurchase,
  updatePurchase,
  createSale,
  updateSale,
} from "../services/finance.js";
import type { Purchase, Sale } from "../types/animal.js";
import { formatMoney } from "../types/format.js";

type Props = {
  animalId: string;
  animalTag: string;
  kind: "purchase" | "sale"; // compra ou venda
  existing?: Purchase | Sale | null; // se vier, é edição; senão, cadastro
  onClose: () => void;
  onSaved: () => void;
};

// Um modal só para os quatro casos: cadastrar/editar × compra/venda.
// O formulário é idêntico nos quatro; só mudam os textos e a função chamada.
export function TradeModal({
  animalId,
  animalTag,
  kind,
  existing,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!existing;
  const isSale = kind === "sale";
  const noun = isSale ? "venda" : "compra";

  // começa vazio no cadastro, preenchido na edição
  const [date, setDate] = useState(existing ? existing.date.slice(0, 10) : "");
  const [weight, setWeight] = useState(
    existing ? String(existing.weightKg).replace(".", ",") : "",
  );
  const [price, setPrice] = useState(
    existing ? String(existing.pricePerKg).replace(".", ",") : "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const weightNumber = Number(weight.replace(",", "."));
  const priceNumber = Number(price.replace(",", "."));
  // prévia do valor total, só quando os dois números são válidos
  const total =
    weight && price && weightNumber > 0 && priceNumber > 0
      ? weightNumber * priceNumber
      : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date) return setError(`Informe a data da ${noun}.`);
    if (!weight || weightNumber <= 0)
      return setError("Informe um peso maior que zero.");
    if (!price || priceNumber <= 0)
      return setError("Informe um preço por kg maior que zero.");

    const data = {
      date,
      weightKg: weightNumber,
      pricePerKg: priceNumber,
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      if (isSale) {
        isEdit
          ? await updateSale(animalId, data)
          : await createSale(animalId, data);
      } else {
        isEdit
          ? await updatePurchase(animalId, data)
          : await createPurchase(animalId, data);
      }
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
          <h2 className="text-lg font-medium text-texto">
            {isEdit ? "Editar" : "Registrar"} {noun}
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
        <p className="text-sm text-texto-suave mb-4">Animal {animalTag}</p>

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

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
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
            <div>
              <label className="block font-medium text-texto mb-1">
                Preço por kg <span className="text-alerta">*</span>
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Ex.: 11,50"
                className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>
          </div>

          {total !== null && (
            <p className="text-sm text-texto-suave mb-4">
              Valor total:{" "}
              <span className="font-medium text-texto">
                {formatMoney(total)}
              </span>
            </p>
          )}

          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Observação
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </div>

          {isSale && !isEdit && (
            <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-4">
              Ao registrar a venda, o animal passa a <strong>Vendido</strong>.
            </p>
          )}

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
              {saving ? "Salvando..." : `Salvar ${noun}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
