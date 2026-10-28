import { useEffect, useId, useState } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useAuth } from "./AuthProvider.js";
import { addAnimalsToLot, listLots, removeAnimalsFromLot } from "../services/lots.js";
import type { Lot, LotMoveResult } from "../types/lot.js";
import { todayInTimeZone } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorMessage } from "../i18n/errors.js";

// Mudar animais de lote (D-49): para outro lote ou "sem lote", numa data.
// O servidor fecha o período atual na data e abre o novo — o histórico de
// entrada e saída fica guardado. Problemas por animal voltam em lista.

type Props = {
  animalIds: string[];
  currentLotId: string | null; // lote de onde saem (null = sem lote hoje)
  title: string;
  onClose: () => void;
  onMoved: (result: LotMoveResult) => void;
};

const NO_LOT = "none";

export function LotMoveModal({ animalIds, currentLotId, title, onClose, onMoved }: Props) {
  const id = useId();
  const { account } = useAuth();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [target, setTarget] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLots()
      .then((data) => setLots(data.filter((lot) => lot.id !== currentLotId)))
      .catch(() => setLoadFailed(true));
  }, [currentLotId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProblems([]);
    if (!target) return setError(t("lots.targetRequired"));
    if (!date) return setError(t("lots.dateRequired"));
    setSaving(true);
    try {
      const result =
        target === NO_LOT
          ? await removeAnimalsFromLot(currentLotId!, animalIds, date)
          : await addAnimalsToLot(target, animalIds, date);
      onMoved(result);
    } catch (err) {
      const fieldErrors = (err as { errors?: { field: string; code?: string; params?: Record<string, unknown> }[] })?.errors;
      setError(errorMessage(err));
      if (fieldErrors?.length) setProblems(fieldErrors.map(fieldErrorMessage));
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      title={title}
      subtitle={t("common.animalsCount", { count: animalIds.length })}
      onClose={onClose}
      dirty={target !== "" || date !== today}
      busy={saving}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor={`${id}-target`} className="block font-medium text-texto mb-1">
            {t("lots.target")}
          </label>
          {loadFailed ? (
            <p role="alert" className="text-sm text-alerta">
              {t("lots.loadFailed")}
            </p>
          ) : (
            <select
              id={`${id}-target`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={lots === null}
              className="w-full border border-borda rounded-lg px-3 py-2.5 text-texto bg-card cursor-pointer"
            >
              <option value="">{lots === null ? t("common.loading") : t("lots.chooseTarget")}</option>
              {(lots ?? []).map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
              {currentLotId && <option value={NO_LOT}>{t("lots.noLotTarget")}</option>}
            </select>
          )}
          {lots !== null && lots.length === 0 && !currentLotId && (
            <p className="text-sm text-texto-suave mt-1">{t("lots.noLotsYet")}</p>
          )}
        </div>
        <div className="mb-5">
          <label htmlFor={`${id}-date`} className="block font-medium text-texto mb-1">
            {t("lots.moveDate")}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>
        {error && (
          <div role="alert" className="text-sm text-alerta mb-4">
            <p>{error}</p>
            {problems.length > 0 && (
              <ul className="list-disc pl-5 mt-1">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className={buttonClass("secondary")}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving || loadFailed} className={buttonClass("primary")}>
            {saving ? t("common.saving") : t("lots.moveConfirm")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
