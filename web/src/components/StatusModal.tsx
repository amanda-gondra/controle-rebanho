import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useId, useState } from "react";
import type { FormEvent } from "react";
import { updateStatus } from "../services/animals.js";
import type { Animal, DeathCauseCertainty, Status } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";
import { formatDate, todayInTimeZone } from "../types/format.js";
import { useAuth } from "./AuthProvider.js";

// Mudar situação do animal (D-27 — "Espec — Animais", F-ANI-05):
// - ativo → morreu (data, causa, certeza) ou vendido sem registro de venda (data);
// - morto/vendido → corrigir os dados da saída ou voltar para ativo (engano);
// - com venda registrada, só "Desfazer venda" (na seção Financeiro) muda.

type Props = {
  animal: Animal;
  hasSale: boolean;
  onClose: () => void;
  onSaved: () => void;
};

// O que a pessoa escolheu fazer
type Action = "DEAD" | "SOLD" | "ACTIVE";

const CERTAINTIES: DeathCauseCertainty[] = ["NOT_INFORMED", "SUSPECTED", "CONFIRMED"];

// "Morreu" para quem está ativo; "Corrigir…" para quem já está morto/vendido
function actionLabel(action: Action, current: Status) {
  if (action === "ACTIVE") return t("animal.exit.actionACTIVE");
  if (action === current) return t(action === "DEAD" ? "animal.exit.actionFixDEAD" : "animal.exit.actionFixSOLD");
  return t(action === "DEAD" ? "animal.exit.actionDEAD" : "animal.exit.actionSOLD");
}

export function StatusModal({ animal, hasSale, onClose, onSaved }: Props) {
  const { account } = useAuth();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const current: Status = animal.status;

  // Animal que já saiu começa em "corrigir"; ativo começa sem escolha
  const [action, setAction] = useState<Action | null>(current === "ACTIVE" ? null : current);
  const [exitDate, setExitDate] = useState(animal.exitDate ? animal.exitDate.slice(0, 10) : today);
  const [deathCause, setDeathCause] = useState(animal.deathCause ?? "");
  const [certainty, setCertainty] = useState<DeathCauseCertainty>(
    animal.deathCauseCertainty ?? "NOT_INFORMED",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dateId = useId();
  const causeId = useId();

  // Opções possíveis a partir da situação atual (RN-ANIMAL-010)
  const actions: Action[] = current === "ACTIVE" ? ["DEAD", "SOLD"] : [current, "ACTIVE"];

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    setErrors({});
    if (action !== "ACTIVE" && !exitDate) {
      return setErrors({ exitDate: t("animal.exit.dateRequired") });
    }

    setSaving(true);
    try {
      await updateStatus(
        animal.id,
        action === "ACTIVE"
          ? { status: "ACTIVE" }
          : action === "DEAD"
            ? { status: "DEAD", exitDate, deathCause: deathCause.trim() || null, deathCauseCertainty: certainty }
            : { status: "SOLD", exitDate },
      );
      onSaved();
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? { geral: errorMessage(err, "animal.statusModal.failed") });
      setSaving(false);
    }
  }

  const confirmLabel =
    action === "DEAD"
      ? t(current === "DEAD" ? "animal.exit.saveDeath" : "animal.exit.registerDeath", { tag: animal.tag })
      : action === "SOLD"
        ? t(current === "SOLD" ? "animal.exit.saveSold" : "animal.exit.markSold")
        : t("animal.exit.backToActive");

  const dirty =
    action !== (current === "ACTIVE" ? null : current) ||
    exitDate !== (animal.exitDate ? animal.exitDate.slice(0, 10) : today) ||
    deathCause !== (animal.deathCause ?? "") ||
    certainty !== (animal.deathCauseCertainty ?? "NOT_INFORMED");

  return (
    <ModalFrame title={t("animal.statusModal.title")} onClose={onClose} dirty={dirty} busy={saving}>

      {hasSale ? (
        // Com venda registrada, a saída é a da venda (D-06)
        <>
          <p className="text-sm text-texto-suave mb-5">{t("animal.exit.hasSale")}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer"
            >
              {t("common.close")}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleSave} noValidate>
          <p className="text-sm text-texto-suave mb-4">
            {t("animal.statusModal.question", { tag: animal.tag })}
          </p>

          <div role="radiogroup" aria-label={t("animal.statusModal.title")} className="flex flex-col gap-2 mb-5">
            {actions.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={action === value}
                onClick={() => setAction(value)}
                className={`py-2.5 px-3 rounded-lg border font-medium text-left cursor-pointer ${
                  action === value
                    ? "bg-verde-claro border-verde text-verde-escuro"
                    : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {actionLabel(value, current)}
              </button>
            ))}
          </div>

          {(action === "DEAD" || action === "SOLD") && (
            <div className="mb-4">
              <label htmlFor={dateId} className="block font-medium text-texto mb-1">
                {t(action === "DEAD" ? "animal.exit.deathDate" : "animal.exit.exitDate")}{" "}
                <span className="text-alerta">*</span>
              </label>
              <input
                id={dateId}
                type="date"
                value={exitDate}
                max={today}
                onChange={(e) => setExitDate(e.target.value)}
                aria-invalid={!!errors.exitDate}
                className={`border rounded-lg px-3 py-2 text-texto ${errors.exitDate ? "border-alerta" : "border-borda"}`}
              />
              {errors.exitDate && (
                <p role="alert" className="text-sm text-alerta mt-1">
                  {errors.exitDate}
                </p>
              )}
            </div>
          )}

          {action === "DEAD" && (
            <>
              <div className="mb-4">
                <label htmlFor={causeId} className="block font-medium text-texto mb-1">
                  {t("animal.exit.cause")}{" "}
                  <span className="text-texto-leve font-normal">{t("common.optional")}</span>
                </label>
                <input
                  id={causeId}
                  value={deathCause}
                  maxLength={200}
                  onChange={(e) => setDeathCause(e.target.value)}
                  placeholder={t("animal.exit.causePlaceholder")}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                />
                {errors.deathCause && <p className="text-sm text-alerta mt-1">{errors.deathCause}</p>}
              </div>
              <fieldset className="mb-5">
                <legend className="block font-medium text-texto mb-1">{t("animal.exit.certainty")}</legend>
                <div className="flex flex-wrap gap-2">
                  {CERTAINTIES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={certainty === value}
                      onClick={() => setCertainty(value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                        certainty === value
                          ? "bg-verde-claro border-verde text-verde-escuro"
                          : "bg-card border-borda-chip text-texto-suave"
                      }`}
                    >
                      {t(`animal.exit.certainty${value}`)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-texto-leve mt-1">{t("animal.exit.noDiagnosis")}</p>
              </fieldset>
            </>
          )}

          {action === "SOLD" && current === "ACTIVE" && (
            <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-4">
              {t("animal.exit.useSaleHint")}
            </p>
          )}

          {action === "ACTIVE" && (
            <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-4">
              {t("animal.exit.backToActiveHint", {
                date: animal.exitDate ? formatDate(animal.exitDate) : t("animal.exit.noDate"),
              })}
            </p>
          )}

          {errors.geral && <p className="text-sm text-alerta mb-4">{errors.geral}</p>}

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
              disabled={saving || !action}
              className={`px-4 py-2.5 rounded-xl text-white font-medium cursor-pointer disabled:opacity-60 ${
                action === "DEAD" ? "bg-alerta" : "bg-verde"
              }`}
            >
              {saving ? t("common.saving") : action ? confirmLabel : t("common.confirm")}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}
