import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, ChevronRight, Filter, Layers, Lightbulb, Pencil, Plus, Search } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { LotFormModal } from "../components/LotFormModal.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useToast } from "../components/ToastProvider.js";
import { StatCard } from "../components/ui/StatCard.js";
import { IconCircle } from "../components/ui/IconCircle.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { ActionsMenu } from "../components/ui/ActionsMenu.js";
import { CowIcon } from "../components/ui/CowIcon.js";
import { listLots, setLotArchived } from "../services/lots.js";
import type { Lot } from "../types/lot.js";
import { formatNumber } from "../types/format.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice, readText } from "../navigation/listParams.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Lotes (D-49, versão simples): indicadores, busca, filtro de situação e a
// lista com quantos animais ativos há em cada lote. Busca e filtro ficam no
// endereço. Arquivar só lote vazio (o servidor confere).

const STATUS_VALUES = ["active", "archived", "all"] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];
const DEFAULTS = { q: "", status: "active" };

export function LotList() {
  const open = useOpen();
  const originState = useOriginState();
  const showToast = useToast();
  const [params, setParams] = useSearchParams();
  const search = readText(params, "q");
  const status: StatusFilter = readChoice(params, "status", STATUS_VALUES, "active");
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lot | null>(null);

  const update = (changes: Partial<typeof DEFAULTS>) =>
    setParams(buildParams({ q: search, status, ...changes }, DEFAULTS), { replace: true });

  // Uma busca com os arquivados: os indicadores contam os dois
  const load = useCallback(() => {
    setLoadError("");
    listLots(true)
      .then(setLots)
      .catch((err) => setLoadError(errorMessage(err, "lots.loadFailed")));
  }, []);
  useEffect(load, [load]);

  const active = useMemo(() => (lots ?? []).filter((lot) => !lot.archivedAt), [lots]);
  const archived = (lots ?? []).length - active.length;
  const inLots = active.reduce((sum, lot) => sum + lot.activeCount, 0);
  const wanted = search.trim().toLocaleLowerCase();
  const visible = (lots ?? []).filter(
    (lot) =>
      (status === "all" || (status === "active" ? !lot.archivedAt : !!lot.archivedAt)) &&
      (!wanted || `${lot.name} ${lot.description ?? ""}`.toLocaleLowerCase().includes(wanted)),
  );

  async function toggleArchive(lot: Lot) {
    try {
      await setLotArchived(lot.id, !lot.archivedAt);
      showToast(t(lot.archivedAt ? "lots.unarchived" : "lots.archived"));
      load();
    } catch (err) {
      showToast(errorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:px-8 md:py-6">
        <PageHeader
          title={t("lots.title")}
          subtitle={t("lots.subtitle")}
          actions={
            <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("lots.new")}
            </button>
          }
        />

        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : lots === null ? (
          <p className="text-texto-suave" aria-busy="true">
            {t("common.loading")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <StatCard icon={<Layers size={20} />} label={t("lots.kpiActive")} value={formatNumber(active.length)} rule={t("lots.kpiActiveHelp")} />
              <StatCard icon={<CowIcon size={28} />} label={t("lots.kpiAnimals")} value={formatNumber(inLots)} rule={t("lots.kpiAnimalsHelp")} />
              <StatCard icon={<Archive size={20} />} tone="neutral" label={t("lots.kpiArchived")} value={formatNumber(archived)} rule={t("lots.kpiArchivedHelp")} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_18rem] gap-5 items-start">
              <div className="min-w-0">
                {/* Busca e filtro */}
                <div className="bg-card border border-borda rounded-xl p-4 mb-5 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve" />
                    <input
                      value={search}
                      onChange={(e) => update({ q: e.target.value })}
                      placeholder={t("lots.searchPlaceholder")}
                      aria-label={t("lots.searchPlaceholder")}
                      className="w-full border border-borda rounded-lg pl-10 pr-3 py-2.5 text-texto placeholder:text-texto-leve"
                    />
                  </div>
                  <label className="relative sm:w-56">
                    <span className="sr-only">{t("lots.statusFilter")}</span>
                    <Filter size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave pointer-events-none" />
                    <select
                      value={status}
                      onChange={(e) => update({ status: e.target.value })}
                      className="w-full appearance-none border border-borda rounded-lg pl-9 pr-8 py-2.5 text-texto bg-card cursor-pointer"
                    >
                      {STATUS_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {t(`lots.status.${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <IconCircle size="sm" tone="neutral">
                    <Layers size={17} />
                  </IconCircle>
                  <div>
                    <h2 className="font-semibold text-texto">{t("lots.listTitle")}</h2>
                    <p className="text-xs text-texto-suave">{t("lots.listHelp")}</p>
                  </div>
                </div>

                {lots.length === 0 ? (
                  <div className="bg-card border border-borda rounded-xl">
                    <EmptyState
                      icon={<Layers size={24} />}
                      title={t("lots.emptyTitle")}
                      help={t("lots.emptyHelp")}
                      action={
                        <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
                          <Plus size={18} aria-hidden="true" /> {t("lots.new")}
                        </button>
                      }
                    />
                  </div>
                ) : visible.length === 0 ? (
                  <div className="bg-card border border-borda rounded-xl">
                    <EmptyState
                      icon={<Search size={22} />}
                      title={t("lots.noMatch")}
                      action={
                        <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className={buttonClass("secondary")}>
                          {t("herd.clearFilters")}
                        </button>
                      }
                    />
                  </div>
                ) : (
                  <div className="bg-card border border-borda rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F7F6F2] text-left text-xs text-texto-suave max-sm:hidden">
                        <tr>
                          <th scope="col" className="font-medium px-5 py-3">{t("lots.colLot")}</th>
                          <th scope="col" className="font-medium px-3 py-3">{t("lots.colStatus")}</th>
                          <th scope="col" className="font-medium px-3 py-3">{t("lots.colAnimals")}</th>
                          <th scope="col" className="font-medium px-5 py-3 text-right">{t("common.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borda">
                        {visible.map((lot) => (
                          <tr key={lot.id} className="hover:bg-bege/60 max-sm:flex max-sm:flex-wrap max-sm:items-center">
                            <td className="px-5 py-3.5 max-sm:w-full max-sm:pb-1">
                              <Link to={`/lotes/${lot.id}`} state={originState} className="flex items-center gap-3 group">
                                <IconCircle size="sm">
                                  <Layers size={17} />
                                </IconCircle>
                                <span className="min-w-0">
                                  <span className="block font-semibold text-texto group-hover:text-verde truncate">{lot.name}</span>
                                  {lot.description && <span className="block text-xs text-texto-suave truncate">{lot.description}</span>}
                                </span>
                              </Link>
                            </td>
                            <td className="px-3 py-3.5 max-sm:pl-[4.25rem] max-sm:py-1">
                              {lot.archivedAt ? <StatusBadge tone="gray">{t("lots.archivedBadge")}</StatusBadge> : <StatusBadge tone="green">{t("lots.activeBadge")}</StatusBadge>}
                            </td>
                            <td className="px-3 py-3.5 text-texto max-sm:py-1">
                              <span className="inline-flex items-center gap-2">
                                <CowIcon size={16} className="text-texto-suave" />
                                {t("common.animalsCount", { count: lot.activeCount })}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 max-sm:ml-auto max-sm:py-1">
                              <span className="flex items-center justify-end gap-1">
                                <Link
                                  to={`/lotes/${lot.id}`}
                                  state={originState}
                                  aria-label={t("lots.openLot", { name: lot.name })}
                                  className="p-1.5 rounded-lg text-texto-suave hover:bg-bege hover:text-verde"
                                >
                                  <ChevronRight size={18} aria-hidden="true" />
                                </Link>
                                <ActionsMenu
                                  label={t("lots.actionsFor", { name: lot.name })}
                                  actions={[
                                    { label: t("lots.editTitle"), icon: <Pencil size={15} aria-hidden="true" />, onSelect: () => setEditing(lot) },
                                    lot.archivedAt
                                      ? { label: t("lots.unarchive"), icon: <ArchiveRestore size={15} aria-hidden="true" />, onSelect: () => toggleArchive(lot) }
                                      : {
                                          label: t("lots.archive"),
                                          icon: <Archive size={15} aria-hidden="true" />,
                                          onSelect: () => toggleArchive(lot),
                                          disabled: lot.activeCount > 0,
                                        },
                                  ]}
                                />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Visão geral */}
              <aside className="bg-card border border-borda rounded-xl p-5">
                <p className="flex items-center gap-2 font-semibold text-texto mb-4">
                  <IconCircle size="sm" tone="neutral">
                    <Lightbulb size={17} />
                  </IconCircle>
                  {t("lots.overviewTitle")}
                </p>
                <div className="flex justify-center my-4" aria-hidden="true">
                  <span className="relative flex items-center justify-center w-28 h-28 rounded-full bg-verde-claro text-verde">
                    <Layers size={56} strokeWidth={1.4} />
                    <CowIcon size={30} className="absolute -top-1 right-1 text-verde-escuro" />
                  </span>
                </div>
                <p className="font-semibold text-texto">{t("lots.overviewLead")}</p>
                <hr className="border-borda my-3" />
                <p className="text-sm text-texto-suave">{t("lots.overviewBody")}</p>
              </aside>
            </div>
          </>
        )}

        {(creating || editing) && (
          <LotFormModal
            lot={editing ?? undefined}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={(lot) => {
              const wasCreating = creating;
              setCreating(false);
              setEditing(null);
              showToast(t(wasCreating ? "lots.created" : "lots.saved", { name: lot.name }));
              if (wasCreating) open(`/lotes/${lot.id}`);
              else load();
            }}
          />
        )}
      </main>
    </div>
  );
}
