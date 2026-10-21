import { useId, useState } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useAuth } from "./AuthProvider.js";
import { changeTag } from "../services/animals.js";
import type { TagChangeReason } from "../types/animal.js";
import { todayInTimeZone } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";

// Trocar brinco (D-19, F-ANI-06): novo brinco + motivo + data. O animal é o
// mesmo: pesagens, aplicações e negociações continuam nele; o brinco antigo
// fica na linha do tempo e a busca encontra o animal pelos dois.

const REASONS: TagChangeReason[] = ["LOST", "DAMAGED", "TYPO", "OTHER"];

type Props = {
  animalId: string;
  currentTag: string;
  onClose: () => void;
  onSaved: (newTag: string) => void;
};

export function TagChangeModal({ animalId, currentTag, onClose, onSaved }: Props) {
  const formId = useId();
  const { account } = useAuth();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const [newTag, setNewTag] = useState("");
  const [reason, setReason] = useState<TagChangeReason | "">("");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const dirty = newTag.trim() !== "" || reason !== "" || date !== today;

  function check() {
    const found: Record<string, string> = {};
    if (!newTag.trim()) found.newTag = t("tagChange.newTagRequired");
    else if (newTag.trim() === currentTag) found.newTag = t("errors.codes.SAME_TAG");
    if (!reason) found.reason = t("tagChange.reasonRequired");
    if (!date) found.date = t("weighing.dateRequired");
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await changeTag(animalId, { newTag: newTag.trim(), reason: reason as TagChangeReason, date });
      onSaved(updated.tag);
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? { geral: errorMessage(err) });
      setConfirming(false);
      setSaving(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `${formId}-${field}-error` : undefined);

  return (
    <ModalFrame title={t("tagChange.title")} subtitle={t("tagChange.current", { tag: currentTag })} onClose={onClose} dirty={dirty} busy={saving}>
      {confirming ? (
        <div>
          <p className="text-texto mb-5">{t("tagChange.confirm", { from: currentTag, to: newTag.trim() })}</p>
          {errors.geral && <p role="alert" className="text-sm text-alerta mb-4">{errors.geral}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={buttonClass("secondary")}>
              {t("tagChange.back")}
            </button>
            <button type="button" onClick={save} disabled={saving} className={buttonClass("primary")}>
              {saving ? t("common.saving") : t("tagChange.confirmButton", { tag: newTag.trim() })}
            </button>
          </div>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (check()) setConfirming(true);
          }}
        >
          <div className="mb-4">
            <label htmlFor={`${formId}-tag`} className="block font-medium text-texto mb-1">
              {t("tagChange.newTag")} <span className="text-alerta">*</span>
            </label>
            <input
              id={`${formId}-tag`}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={50}
              aria-invalid={!!errors.newTag}
              aria-describedby={describedBy("newTag")}
              className={`w-full border rounded-lg px-3 py-2 text-texto ${errors.newTag ? "border-alerta" : "border-borda"}`}
            />
            {errors.newTag && (
              <p id={`${formId}-newTag-error`} className="text-sm text-alerta mt-1">
                {errors.newTag}
              </p>
            )}
          </div>

          <fieldset className="mb-4" aria-describedby={describedBy("reason")}>
            <legend className="block font-medium text-texto mb-1">
              {t("tagChange.reasonLabel")} <span className="text-alerta">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((value) => (
                <label
                  key={value}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm ${
                    reason === value ? "bg-verde-claro border-verde text-verde-escuro" : "bg-card border-borda-chip text-texto-suave"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${formId}-reason`}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-verde"
                  />
                  {t(`tagChange.reason.${value}`)}
                </label>
              ))}
            </div>
            {errors.reason && (
              <p id={`${formId}-reason-error`} className="text-sm text-alerta mt-1">
                {errors.reason}
              </p>
            )}
          </fieldset>

          <div className="mb-5">
            <label htmlFor={`${formId}-date`} className="block font-medium text-texto mb-1">
              {t("tagChange.date")} <span className="text-alerta">*</span>
            </label>
            <input
              id={`${formId}-date`}
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!errors.date}
              aria-describedby={describedBy("date")}
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
            {errors.date && (
              <p id={`${formId}-date-error`} className="text-sm text-alerta mt-1">
                {errors.date}
              </p>
            )}
          </div>

          {errors.geral && <p role="alert" className="text-sm text-alerta mb-4">{errors.geral}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={buttonClass("secondary")}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={buttonClass("primary")}>
              {t("tagChange.continue")}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}
