import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useState, useId } from "react";
import { createWeighing } from "../services/animals.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";

type Props = {
  animalId: string;
  animalTag: string;
  onClose: () => void; // fechar sem salvar
  onSaved: () => void; // salvou com sucesso
  // Já existe pesagem nesse dia (D-33): abrir a edição dela
  onEditExisting?: (date: string) => void;
};

export function WeighingModal({ animalId, animalTag, onClose, onSaved, onEditExisting }: Props) {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  const [date, setDate] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [duplicateDate, setDuplicateDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); // impede o navegador de recarregar a página
    setError("");
    setDuplicateDate(null);
    if (!date) return setError(t("weighing.dateRequired"));
    const weightNumber = Number(weight.replace(",", "."));
    if (!weight || weightNumber <= 0)
      return setError(t("weighing.weightRequired"));

    setSaving(true);
    try {
      await createWeighing(animalId, { date, weightKg: weightNumber });
      onSaved();
    } catch (err) {
      setError(singleErrorMessage(err));
      if ((err as { code?: string })?.code === "DUPLICATE_WEIGHING_DATE") setDuplicateDate(date);
      setSaving(false);
    }
  }

  // Algo digitado: Esc e clique fora não fecham (não perder o que foi digitado)
  const dirty = date !== "" || weight !== "";

  return (
    <ModalFrame title={t("weighing.newTitle")} subtitle={t("weighing.animal", { tag: animalTag })} onClose={onClose} dirty={dirty} busy={saving}>

      {/* form: Enter dentro dele dispara o onSubmit (salvar) */}
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

        {error && (
          <p role="alert" className="text-sm text-alerta mb-4">
            {error}{" "}
            {duplicateDate && onEditExisting && (
              <button
                type="button"
                onClick={() => onEditExisting(duplicateDate)}
                className="text-verde font-medium underline cursor-pointer"
              >
                {t("weighing.editExisting")}
              </button>
            )}
          </p>
        )}

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
            {saving ? t("common.saving") : t("weighing.save")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}