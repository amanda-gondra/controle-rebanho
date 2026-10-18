import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useState, useId } from "react";
import { updateWeighing } from "../services/animals.js";
import type { Weighing } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";

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
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  // já começa preenchido com os valores atuais da pesagem
  const [date, setDate] = useState(weighing.date.slice(0, 10));
  const [weight, setWeight] = useState(String(weighing.weightKg).replace(".", ","));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!date) return setError(t("weighing.dateRequired"));
    const weightNumber = Number(weight.replace(",", "."));
    if (!weight || weightNumber <= 0)
      return setError(t("weighing.weightRequired"));

    setSaving(true);
    try {
      await updateWeighing(animalId, weighing.id, {
        date,
        weightKg: weightNumber,
      });
      onSaved();
    } catch (err) {
      setError(singleErrorMessage(err));
      setSaving(false);
    }
  }

  const dirty = date !== weighing.date.slice(0, 10) || weight !== String(weighing.weightKg).replace(".", ",");

  return (
    <ModalFrame title={t("weighing.editTitle")} onClose={onClose} dirty={dirty} busy={saving}>

      <form onSubmit={handleSave}>
        <div className="mb-4">
          <label htmlFor={`${formId}-1`} className="block font-medium text-texto mb-1">
            {t("weighing.date")} <span className="text-alerta">*</span>
          </label>
          <input id={`${formId}-1`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`${formId}-2`} className="block font-medium text-texto mb-1">
            {t("weighing.weight")} <span className="text-alerta">*</span>
          </label>
          <input id={`${formId}-2`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={t("weighing.weightPlaceholder")}
            autoFocus
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
            {saving ? t("common.saving") : t("weighing.saveChanges")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}