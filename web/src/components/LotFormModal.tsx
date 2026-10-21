import { useId, useState } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { createLot, updateLot } from "../services/lots.js";
import type { Lot } from "../types/lot.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";

// Criar ou renomear um lote (D-49). Nome único na fazenda (o servidor confere).

type Props = {
  lot?: Lot; // sem lote = criar
  onClose: () => void;
  onSaved: (lot: Lot) => void;
};

export function LotFormModal({ lot, onClose, onSaved }: Props) {
  const id = useId();
  const initial = { name: lot?.name ?? "", description: lot?.description ?? "" };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = form.name !== initial.name || form.description !== initial.description;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setErrors({ name: t("lots.nameRequired") });
    setErrors({});
    setSaving(true);
    const data = { name: form.name.trim(), description: form.description.trim() || null };
    try {
      onSaved(lot ? await updateLot(lot.id, data) : await createLot(data));
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const code = (err as { code?: string })?.code;
      setErrors(code === "DUPLICATE_LOT_NAME" ? { name: errorMessage(err) } : (fields ?? { form: errorMessage(err) }));
      setSaving(false);
    }
  }

  return (
    <ModalFrame title={t(lot ? "lots.editTitle" : "lots.newTitle")} onClose={onClose} dirty={dirty} busy={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor={`${id}-name`} className="block font-medium text-texto mb-1">
            {t("lots.name")} <span className="text-alerta">*</span>
          </label>
          <input
            id={`${id}-name`}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t("lots.namePlaceholder")}
            maxLength={100}
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            className={`w-full border rounded-lg px-3 py-2 text-texto ${errors.name ? "border-alerta" : "border-borda"}`}
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="text-sm text-alerta mt-1">
              {errors.name}
            </p>
          )}
        </div>
        <div className="mb-5">
          <label htmlFor={`${id}-description`} className="block font-medium text-texto mb-1">
            {t("lots.description")} <span className="text-texto-leve font-normal">{t("common.optional")}</span>
          </label>
          <textarea
            id={`${id}-description`}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t("lots.descriptionPlaceholder")}
            rows={2}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>
        {(errors.form || errors.description) && (
          <p role="alert" className="text-sm text-alerta mb-4">
            {errors.form ?? errors.description}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className={buttonClass("secondary")}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
