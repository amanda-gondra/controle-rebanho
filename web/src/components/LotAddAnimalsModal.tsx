import { useEffect, useId, useState } from "react";
import { Check, Search } from "lucide-react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useAuth } from "./AuthProvider.js";
import { listAnimals } from "../services/animals.js";
import { addAnimalsToLot } from "../services/lots.js";
import type { Animal } from "../types/animal.js";
import type { LotMoveResult } from "../types/lot.js";
import { todayInTimeZone } from "../types/format.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorMessage } from "../i18n/errors.js";

// Colocar animais ativos num lote (D-49). Busca no servidor (brinco, raça,
// categoria); quem já está em outro lote troca de lote na data escolhida — a
// tela avisa antes. Quem já está neste lote não aparece.

type Props = {
  lotId: string;
  lotName: string;
  onClose: () => void;
  onAdded: (result: LotMoveResult) => void;
};

const RESULTS = 50;

export function LotAddAnimalsModal({ lotId, lotName, onClose, onAdded }: Props) {
  const id = useId();
  const { account } = useAuth();
  const { labelOf } = useCategoryLabels();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Animal[] | null>(null);
  const [total, setTotal] = useState(0);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<Map<string, Animal>>(new Map());
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Busca com uma pequena espera enquanto digita
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearchFailed(false);
      listAnimals({ q: query.trim() || undefined, status: "ACTIVE", sortBy: "tag", order: "asc", pageSize: RESULTS })
        .then((page) => {
          if (cancelled) return;
          setResults(page.items.filter((animal) => animal.lot?.id !== lotId));
          setTotal(page.total);
        })
        .catch(() => !cancelled && setSearchFailed(true));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, lotId]);

  function toggle(animal: Animal) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(animal.id)) next.delete(animal.id);
      else next.set(animal.id, animal);
      return next;
    });
  }

  const movingFromOther = [...selected.values()].filter((animal) => animal.lot);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProblems([]);
    if (selected.size === 0) return setError(t("lots.animalsRequired"));
    setSaving(true);
    try {
      onAdded(await addAnimalsToLot(lotId, [...selected.keys()], date));
    } catch (err) {
      const fieldErrors = (err as { errors?: { field: string; code?: string; params?: Record<string, unknown> }[] })?.errors;
      setError(errorMessage(err));
      if (fieldErrors?.length) setProblems(fieldErrors.map(fieldErrorMessage));
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      title={t("lots.addTitle", { name: lotName })}
      onClose={onClose}
      dirty={selected.size > 0}
      busy={saving}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="relative mb-3">
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("herd.searchPlaceholder")}
            aria-label={t("herd.searchPlaceholder")}
            autoFocus
            className="w-full bg-bege border border-borda rounded-lg pl-9 pr-3 py-2 text-sm text-texto"
          />
        </div>

        <div className="max-h-72 overflow-y-auto flex flex-col gap-2 mb-2" aria-live="polite">
          {searchFailed ? (
            <p role="alert" className="text-sm text-alerta">
              {t("herd.loadFailed")}
            </p>
          ) : results === null ? (
            <p className="text-sm text-texto-suave" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-texto-suave">{t("lots.noCandidates")}</p>
          ) : (
            results.map((animal) => {
              const isSelected = selected.has(animal.id);
              return (
                <button
                  key={animal.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(animal)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left cursor-pointer ${
                    isSelected ? "bg-verde-claro border-verde" : "bg-card border-borda-chip"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 ${
                      isSelected ? "bg-verde border-verde text-white" : "border-borda-chip"
                    }`}
                  >
                    {isSelected && <Check size={14} aria-hidden="true" />}
                  </span>
                  <span className="font-medium text-texto w-20 truncate">{animal.tag}</span>
                  <span className="flex-1 min-w-0 text-sm text-texto-suave truncate">
                    {labelOf(animal.category, animal.sex)}
                    {animal.lot ? ` · ${t("lots.inLot", { name: animal.lot.name })}` : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {results !== null && total > RESULTS && (
          <p className="text-xs text-texto-suave mb-2">{t("lots.refineSearch", { shown: RESULTS, total })}</p>
        )}

        <p className="text-sm text-texto mb-3">{t("lots.selectedCount", { count: selected.size })}</p>
        {movingFromOther.length > 0 && (
          <p className="text-sm text-texto bg-bege rounded-lg px-3 py-2 mb-3">
            {t("lots.willLeaveOther", { count: movingFromOther.length })}
          </p>
        )}

        <div className="mb-5">
          <label htmlFor={`${id}-date`} className="block font-medium text-texto mb-1">
            {t("lots.entryDate")}
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
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? t("common.saving") : t("lots.addConfirm", { count: selected.size })}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
