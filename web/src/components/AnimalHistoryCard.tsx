import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { getAnimalHistory } from "../services/animals.js";
import type { Animal, AnimalEvent } from "../types/animal.js";
import { describeEvent } from "../types/history.js";
import { formatDate } from "../types/format.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { LoadError } from "./LoadError.js";
import { buttonClass } from "./buttonStyles.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Linha do tempo do animal (D-28): o que mudou, quando e quem registrou —
// mais recente primeiro, 20 por vez. Fecha com "Cadastrado em …".
// `refreshKey` muda quando a ficha grava algo (a lista recarrega).

const PAGE_SIZE = 20;

export function AnimalHistoryCard({ animal, refreshKey }: { animal: Animal; refreshKey: number }) {
  const { labelOf } = useCategoryLabels();
  const [items, setItems] = useState<AnimalEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    (nextPage: number) => {
      setLoading(true);
      setError("");
      getAnimalHistory(animal.id, nextPage, PAGE_SIZE)
        .then((data) => {
          setItems((previous) => (nextPage === 1 ? data.items : [...previous, ...data.items]));
          setTotal(data.total);
          setPage(nextPage);
        })
        .catch((err) => setError(errorMessage(err, "history.loadFailed")))
        .finally(() => setLoading(false));
    },
    [animal.id],
  );

  useEffect(() => load(1), [load, refreshKey]);

  const labels = { category: (category: Animal["category"]) => labelOf(category, animal.sex), sex: (sex: Animal["sex"]) => sexLabel[sex] };

  return (
    <section className="bg-card border border-borda rounded-xl p-6 mt-6" aria-labelledby="history-title">
      <h2 id="history-title" className="flex items-center gap-2 font-medium text-texto mb-4">
        <History size={18} className="text-verde" aria-hidden="true" /> {t("history.title")}
      </h2>
      {error && items.length === 0 ? (
        <LoadError compact message={error} onRetry={() => load(1)} />
      ) : (
        <ol className="flex flex-col divide-y divide-borda">
          {items.map((event) => (
            <li key={event.id} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
              <span className="text-sm text-texto-suave w-24 shrink-0">{formatDate(event.effectiveDate)}</span>
              <span className="flex-1 text-texto text-sm">{describeEvent(event, labels)}</span>
              {event.userName && (
                <span className="text-xs text-texto-leve">{t("history.by", { name: event.userName })}</span>
              )}
            </li>
          ))}
          {!loading && items.length === total && (
            <li className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
              <span className="text-sm text-texto-suave w-24 shrink-0">{formatDate(animal.createdAt)}</span>
              <span className="flex-1 text-texto-suave text-sm">{t("history.created")}</span>
            </li>
          )}
        </ol>
      )}
      {loading && <p className="text-sm text-texto-suave mt-2" aria-busy="true">{t("common.loading")}</p>}
      {error && items.length > 0 && <LoadError compact message={error} onRetry={() => load(page + 1)} />}
      {!loading && items.length < total && (
        <button type="button" onClick={() => load(page + 1)} className={buttonClass("secondary", "mt-3 text-sm px-3 py-2")}>
          {t("history.more", { count: total - items.length })}
        </button>
      )}
    </section>
  );
}
