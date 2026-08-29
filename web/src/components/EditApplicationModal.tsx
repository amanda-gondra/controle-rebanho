import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listProducts, updateApplication } from "../services/sanitary.js";
import type { Application, Product, ProductType } from "../types/animal.js";

type Props = {
  application: Application;
  onClose: () => void;
  onSaved: () => void;
};

export function EditApplicationModal({ application, onClose, onSaved }: Props) {
  // começa preenchido com os valores atuais da aplicação
  const [type, setType] = useState<ProductType>(application.product.type);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState(application.productId);
  const [date, setDate] = useState(application.date.slice(0, 10));
  const [needsReapply, setNeedsReapply] = useState(
    application.reapplyDate != null,
  );
  const [reapplyDate, setReapplyDate] = useState(
    application.reapplyDate ? application.reapplyDate.slice(0, 10) : "",
  );
  const [notes, setNotes] = useState(application.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // carrega os produtos do tipo escolhido
  useEffect(() => {
    listProducts(type)
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
  }, [type]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!productId) return setError("Escolha o produto.");
    if (!date) return setError("Informe a data da aplicação.");
    if (needsReapply && !reapplyDate)
      return setError("Informe a data da reaplicação.");

    setSaving(true);
    try {
      await updateApplication(application.id, {
        productId,
        date,
        reapplyDate: needsReapply ? reapplyDate : undefined,
        notes: notes.trim() || undefined,
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
        className="bg-card rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-medium text-texto">Editar aplicação</h2>
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
          {/* Tipo */}
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">Tipo</label>
            <div className="flex gap-3">
              {(
                [
                  ["VACCINE", "Vacina"],
                  ["DEWORMER", "Vermífugo"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value);
                    setProductId(""); // limpa o produto ao trocar de tipo
                  }}
                  className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                    type === value
                      ? "bg-verde border-verde text-white"
                      : "bg-card border-borda-chip text-texto-suave"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Produto */}
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Produto <span className="text-alerta">*</span>
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
            >
              <option value="">Escolha o produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Data <span className="text-alerta">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </div>

          {/* Reaplicação */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needsReapply}
                onChange={(e) => setNeedsReapply(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-[#3B6D11]"
              />
              <span className="font-medium text-texto">Precisa reaplicar</span>
            </label>
            {needsReapply && (
              <div className="mt-2">
                <label className="block text-sm text-texto-suave mb-1">
                  Data da reaplicação
                </label>
                <input
                  type="date"
                  value={reapplyDate}
                  onChange={(e) => setReapplyDate(e.target.value)}
                  className="border border-borda rounded-lg px-3 py-2 text-texto"
                />
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              Observação{" "}
              <span className="text-texto-leve font-normal">(opcional)</span>
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: 1ª dose"
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