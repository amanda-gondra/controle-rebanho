import { useState } from "react";
import { X } from "lucide-react";
import { setEstimatedPrice } from "../services/finance.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";

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
      return setError(t("estimatedPrice.priceRequired"));
    }

    setSaving(true);
    try {
      await setEstimatedPrice(animalId, value);
      onSaved();
    } catch (err) {
      setError(singleErrorMessage(err));
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
          <h2 className="text-lg font-medium text-texto">{t("estimatedPrice.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-texto-suave mb-4">
          {t("estimatedPrice.intro", { tag: animalTag })}
        </p>

        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block font-medium text-texto mb-1">
              {t("estimatedPrice.pricePerKg")}
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("estimatedPrice.pricePlaceholder")}
              autoFocus
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
            <p className="text-xs text-texto-leve mt-1">
              {t("estimatedPrice.clearHint")}
            </p>
          </div>

          {error && <p className="text-sm text-alerta mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
