import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useEffect, useState, useId } from "react";
import { listProducts, updateApplication } from "../services/sanitary.js";
import type { Application, Product, ProductType } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";

type Props = {
  application: Application;
  onClose: () => void;
  onSaved: () => void;
};

export function EditApplicationModal({ application, onClose, onSaved }: Props) {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
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
      .catch(() => setError(t("application.productsLoadFailed")));
  }, [type]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!productId) return setError(t("application.productRequired"));
    if (!date) return setError(t("application.dateRequired"));
    if (needsReapply && !reapplyDate)
      return setError(t("application.reapplyDateRequired"));

    setSaving(true);
    try {
      await updateApplication(application.id, {
        productId,
        date,
        reapplyDate: needsReapply ? reapplyDate : undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(singleErrorMessage(err));
      setSaving(false);
    }
  }

  const dirty =
    productId !== application.productId ||
    date !== application.date.slice(0, 10) ||
    needsReapply !== (application.reapplyDate != null) ||
    reapplyDate !== (application.reapplyDate ? application.reapplyDate.slice(0, 10) : "") ||
    notes !== (application.notes ?? "");

  return (
    <ModalFrame title={t("application.editTitle")} onClose={onClose} dirty={dirty} busy={saving}>

      <form onSubmit={handleSave}>
        {/* Tipo */}
        <div className="mb-4">
          <label className="block font-medium text-texto mb-1">{t("application.type")}</label>
          <div className="flex gap-3">
            {(["VACCINE", "DEWORMER"] as const).map((value) => (
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
                {t(`product.type.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Produto */}
        <div className="mb-4">
          <label htmlFor={`${formId}-1`} className="block font-medium text-texto mb-1">
            {t("application.product")} <span className="text-alerta">*</span>
          </label>
          <select id={`${formId}-1`}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
          >
            <option value="">{t("application.chooseProduct")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Data */}
        <div className="mb-4">
          <label htmlFor={`${formId}-2`} className="block font-medium text-texto mb-1">
            {t("application.date")} <span className="text-alerta">*</span>
          </label>
          <input id={`${formId}-2`}
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
            <span className="font-medium text-texto">{t("application.needsReapply")}</span>
          </label>
          {needsReapply && (
            <div className="mt-2">
              <label htmlFor={`${formId}-3`} className="block text-sm text-texto-suave mb-1">
                {t("application.reapplyDate")}
              </label>
              <input id={`${formId}-3`}
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
          <label htmlFor={`${formId}-4`} className="block font-medium text-texto mb-1">
            {t("application.notes")}{" "}
            <span className="text-texto-leve font-normal">{t("common.optional")}</span>
          </label>
          <input id={`${formId}-4`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("application.notesPlaceholder")}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        {error && <p className="text-sm text-alerta mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("secondary")}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className={buttonClass("primary")}
          >
            {saving ? t("common.saving") : t("application.saveChanges")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}