import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Layers, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { LotFormModal } from "../components/LotFormModal.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useToast } from "../components/ToastProvider.js";
import { listLots } from "../services/lots.js";
import type { Lot } from "../types/lot.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Lotes (D-49, versão simples): a lista com quantos animais ativos há em cada
// um. Arquivados ficam escondidos, mas podem ser mostrados (filtro no endereço).

export function LotList() {
  const open = useOpen();
  const originState = useOriginState();
  const showToast = useToast();
  const [params, setParams] = useSearchParams();
  const showArchived = params.get("archived") === "1";
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoadError("");
    setLots(null);
    listLots(showArchived)
      .then(setLots)
      .catch((err) => setLoadError(errorMessage(err, "lots.loadFailed")));
  }, [showArchived]);
  useEffect(load, [load]);

  const inHerd = (lots ?? []).filter((lot) => !lot.archivedAt).reduce((sum, lot) => sum + lot.activeCount, 0);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("lots.title")}
          subtitle={t("lots.subtitle")}
          actions={
            <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("lots.new")}
            </button>
          }
        />

        <label className="inline-flex items-center gap-2 text-sm text-texto mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setParams(e.target.checked ? { archived: "1" } : {}, { replace: true })}
          />
          {t("lots.showArchived")}
        </label>

        <div className="max-w-3xl">
          {loadError ? (
            <LoadError message={loadError} onRetry={load} />
          ) : lots === null ? (
            <p className="text-texto-suave" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : lots.length === 0 ? (
            <div className="bg-card border border-borda rounded-xl p-10 text-center">
              <Layers size={28} className="mx-auto text-verde mb-2" aria-hidden="true" />
              <p className="text-texto font-medium mb-1">{t("lots.emptyTitle")}</p>
              <p className="text-texto-suave text-sm mb-4">{t("lots.emptyHelp")}</p>
              <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
                <Plus size={18} aria-hidden="true" /> {t("lots.new")}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-texto-suave mb-2">{t("lots.totalInLots", { count: inHerd })}</p>
              <ul className="bg-card border border-borda rounded-xl divide-y divide-borda">
                {lots.map((lot) => (
                  <li key={lot.id}>
                    <Link
                      to={`/lotes/${lot.id}`}
                      state={originState}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-bege"
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-verde-claro text-verde shrink-0">
                        <Layers size={16} aria-hidden="true" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-texto truncate">
                          {lot.name}
                          {lot.archivedAt && (
                            <span className="ml-2 text-xs font-normal rounded px-1.5 py-0.5 bg-bege text-texto-suave">
                              {t("lots.archivedBadge")}
                            </span>
                          )}
                        </span>
                        {lot.description && <span className="block text-xs text-texto-suave truncate">{lot.description}</span>}
                      </span>
                      <span className="text-sm text-texto shrink-0">{t("common.animalsCount", { count: lot.activeCount })}</span>
                      <ChevronRight size={18} className="text-texto-leve shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {creating && (
          <LotFormModal
            onClose={() => setCreating(false)}
            onSaved={(lot) => {
              setCreating(false);
              showToast(t("lots.created", { name: lot.name }));
              open(`/lotes/${lot.id}`);
            }}
          />
        )}
      </main>
    </div>
  );
}
