import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Info,
  Leaf,
  LogIn,
  LogOut,
  Mars,
  Pencil,
  Plus,
  Scale,
  Search,
  Syringe,
  Trash2,
  TrendingUp,
  Venus,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { LotFormModal } from "../components/LotFormModal.js";
import { LotMoveModal } from "../components/LotMoveModal.js";
import { LotAddAnimalsModal } from "../components/LotAddAnimalsModal.js";
import { ProductTypeIcon } from "../components/ProductTypeIcon.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useToast } from "../components/ToastProvider.js";
import { useAuth } from "../components/AuthProvider.js";
import { Pagination } from "../components/ui/Pagination.js";
import { StatCard } from "../components/ui/StatCard.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { ActionsMenu } from "../components/ui/ActionsMenu.js";
import { CowIcon } from "../components/ui/CowIcon.js";
import { deleteLot, getLot, getLotApplications, getLotWeighings, removeAnimalsFromLot, setLotArchived } from "../services/lots.js";
import type { LotApplication, LotDetail as LotDetailData, LotMoveResult, LotWeighing } from "../types/lot.js";
import { formatDate, formatNumber, todayInTimeZone } from "../types/format.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { useOpen, useOrigin, useOriginState } from "../navigation/hooks.js";
import { readChoice } from "../navigation/listParams.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Página do lote (D-49): indicadores calculados no servidor (regras em
// services/lot.service.ts), animais que estão nele agora, pesagens e manejo
// feitos enquanto os animais estavam no lote, e as entradas/saídas. A aba
// fica no endereço (?aba=). Lote com histórico não se exclui: arquiva (vazio).

const TABS = ["animais", "pesagens", "manejo", "movimentacoes"] as const;
type Tab = (typeof TABS)[number];
const PAGE_SIZE = 10;
const MS_PER_DAY = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);

export function LotDetail() {
  const { id } = useParams();
  const { goBack } = useOrigin("/lotes");
  const open = useOpen();
  const originState = useOriginState();
  const showToast = useToast();
  const { account } = useAuth();
  const { labelOf } = useCategoryLabels();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const [params, setParams] = useSearchParams();
  const tab: Tab = readChoice(params, "aba", TABS, "animais");
  const [lot, setLot] = useState<LotDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<{ id: string; tag: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoadError("");
    getLot(id)
      .then((data) => {
        setLot(data);
        setSelected((previous) => new Set([...previous].filter((animalId) => data.animals.some((a) => a.id === animalId))));
      })
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else setLoadError(errorMessage(err, "lots.loadFailed"));
      });
  }, [id]);
  useEffect(load, [load]);

  function afterMove(result: LotMoveResult, message: "lots.moved" | "lots.added") {
    setMoving(null);
    setAdding(false);
    setSelected(new Set());
    showToast(t(message, { count: result.moved }));
    load();
  }

  async function toggleArchive() {
    if (!lot) return;
    setBusy(true);
    try {
      const updated = await setLotArchived(lot.id, !lot.archivedAt);
      showToast(t(updated.archivedAt ? "lots.archived" : "lots.unarchived"));
      load();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!lot) return;
    setBusy(true);
    try {
      await deleteLot(lot.id);
      showToast(t("lots.deleted", { name: lot.name }));
      goBack();
    } catch (err) {
      showToast(errorMessage(err));
      setDeleting(false);
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!lot || !removing) return;
    setBusy(true);
    try {
      await removeAnimalsFromLot(lot.id, [removing.id], today);
      showToast(t("lots.removedOne", { tag: removing.tag }));
      setRemoving(null);
      load();
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:px-8 md:py-6">{content}</main>
    </div>
  );

  if (notFound) {
    return shell(
      <>
        <PageHeader title={t("lots.title")} backFallback="/lotes" backLabel={t("lots.backToList")} backText={t("lots.title")} />
        <div className="bg-card border border-borda rounded-xl p-8 text-center max-w-lg">
          <p className="text-texto font-medium mb-3">{t("lots.notFound")}</p>
          <Link to="/lotes" className={buttonClass("primary")}>
            {t("lots.backToList")}
          </Link>
        </div>
      </>,
    );
  }
  if (!lot) {
    return shell(
      <>
        <PageHeader title={t("lots.title")} backFallback="/lotes" backLabel={t("lots.backToList")} backText={t("lots.title")} />
        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : (
          <p className="text-texto-suave" aria-busy="true">
            {t("common.loading")}
          </p>
        )}
      </>,
    );
  }

  const archived = !!lot.archivedAt;
  // dia de calendário da criação no fuso da fazenda (não o dia em UTC)
  const createdOn = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo", new Date(lot.createdAt));
  const { summary } = lot;
  const wanted = search.trim().toLocaleLowerCase();
  const filtered = lot.animals.filter(
    (animal) =>
      !wanted ||
      `${animal.tag} ${labelOf(animal.category, animal.sex)} ${animal.breed ?? ""}`.toLocaleLowerCase().includes(wanted),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allSelected = pageItems.length > 0 && pageItems.every((animal) => selected.has(animal.id));
  const predominant =
    summary.males === 0 && summary.females === 0
      ? null
      : summary.males > 0 && summary.females > 0
        ? t("lots.sexBoth")
        : summary.males > 0
          ? t("lots.sexMales")
          : t("lots.sexFemales");

  function toggle(animalId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  return shell(
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {lot.name}
            {archived ? <StatusBadge tone="gray">{t("lots.archivedBadge")}</StatusBadge> : <StatusBadge tone="green">{t("lots.activeBadge")}</StatusBadge>}
          </span>
        }
        subtitle={lot.description ?? undefined}
        backFallback="/lotes"
        backLabel={t("lots.backToList")}
        backText={t("lots.title")}
        actions={
          <>
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "text-sm px-3 py-2")}>
              <Pencil size={16} aria-hidden="true" /> {t("lots.edit")}
            </button>
            <button
              type="button"
              onClick={toggleArchive}
              disabled={busy || (!archived && lot.activeCount > 0)}
              title={!archived && lot.activeCount > 0 ? t("lots.archiveOnlyEmpty") : undefined}
              className={buttonClass("secondary", "text-sm px-3 py-2")}
            >
              {archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
              {t(archived ? "lots.unarchive" : "lots.archiveLot")}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              disabled={busy || lot.history.length > 0}
              title={lot.history.length > 0 ? t("lots.deleteOnlyUnused") : undefined}
              className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
            >
              <Trash2 size={16} aria-hidden="true" /> {t("lots.deleteLot")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={archived}
              title={archived ? t("lots.archivedNoEntry") : undefined}
              className={buttonClass("primary")}
            >
              <Plus size={18} aria-hidden="true" /> {t("lots.addAnimals")}
            </button>
          </>
        }
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <StatCard
          icon={<CowIcon size={22} />}
          label={t("lots.kpiTotal")}
          value={formatNumber(lot.activeCount)}
          detail={t("lots.kpiSexes", { males: summary.males, females: summary.females })}
        />
        <StatCard
          icon={<Scale size={20} />}
          label={t("lots.kpiWeight")}
          value={summary.averageWeightKg === null ? "—" : t("units.kgValue", { value: formatNumber(summary.averageWeightKg) })}
          detail={
            summary.lastWeighingDate
              ? t("lots.kpiWeightDetail", { date: formatDate(summary.lastWeighingDate), count: summary.weighedAnimals })
              : t("lots.kpiNoWeighing")
          }
          rule={t("lots.kpiWeightRule")}
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label={t("lots.kpiGain")}
          value={
            summary.gain.averageDailyGainKg === null
              ? "—"
              : t("units.kgPerDay", { value: formatNumber(summary.gain.averageDailyGainKg, { maximumFractionDigits: 3 }) })
          }
          detail={
            summary.gain.from && summary.gain.to
              ? t("lots.kpiGainPeriod", { from: formatDate(summary.gain.from), to: formatDate(summary.gain.to) })
              : t("lots.kpiNoGain")
          }
          rule={t("lots.kpiGainRule")}
        />
        <StatCard
          icon={<CalendarDays size={20} />}
          label={t("lots.kpiFormed")}
          value={lot.formedOn ? formatDate(lot.formedOn) : "—"}
          detail={lot.formedOn ? t("lots.kpiDaysAgo", { count: Math.max(0, daysBetween(lot.formedOn, today)) }) : t("lots.noAnimalsYet")}
          rule={t("lots.kpiFormedRule")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-5 items-start">
        <div className="min-w-0">
          {/* Abas */}
          <div role="tablist" aria-label={t("lots.tabsLabel")} className="bg-card border border-borda rounded-t-xl px-3 flex gap-1 overflow-x-auto">
            {TABS.map((value) => {
              const Icon = value === "animais" ? CowIcon : value === "pesagens" ? Scale : value === "manejo" ? Syringe : ArrowRightLeft;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setParams(value === "animais" ? {} : { aba: value }, { replace: true })}
                  className={`flex items-center gap-2 px-3 py-3.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
                    tab === value ? "border-verde text-verde-escuro" : "border-transparent text-texto-suave hover:text-texto"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" /> {t(`lots.tab.${value}`)}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="bg-card border border-t-0 border-borda rounded-b-xl">
            {tab === "animais" && (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                  <div>
                    <h2 className="font-semibold text-texto">{t("lots.animalsNow")}</h2>
                    <p className="text-xs text-texto-suave">{t("lots.animalsNowHelp")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.size > 0 && (
                      <button type="button" onClick={() => setMoving([...selected])} className={buttonClass("secondary", "text-sm px-3 py-2")}>
                        <ArrowRightLeft size={16} aria-hidden="true" /> {t("lots.moveSelected", { count: selected.size })}
                      </button>
                    )}
                    <div className="relative">
                      <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve" />
                      <input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder={t("lots.searchAnimals")}
                        aria-label={t("lots.searchAnimals")}
                        className="w-60 max-w-full border border-borda rounded-lg pl-9 pr-3 py-2 text-sm text-texto placeholder:text-texto-leve"
                      />
                    </div>
                  </div>
                </div>

                {lot.animals.length === 0 ? (
                  <EmptyState
                    icon={<CowIcon size={24} />}
                    title={t(archived ? "lots.archivedNoEntry" : "lots.noAnimalsYet")}
                    action={
                      !archived && (
                        <button type="button" onClick={() => setAdding(true)} className={buttonClass("primary")}>
                          <Plus size={18} aria-hidden="true" /> {t("lots.addAnimals")}
                        </button>
                      )
                    }
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState icon={<Search size={22} />} title={t("lots.noAnimalMatch")} />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-[#F7F6F2] text-left text-xs text-texto-suave">
                          <tr>
                            <th scope="col" className="px-5 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() =>
                                  setSelected((previous) => {
                                    const next = new Set(previous);
                                    for (const animal of pageItems) {
                                      if (allSelected) next.delete(animal.id);
                                      else next.add(animal.id);
                                    }
                                    return next;
                                  })
                                }
                                aria-label={t("lots.selectAll")}
                              />
                            </th>
                            <th scope="col" className="font-medium px-3 py-3">{t("herd.colTag")}</th>
                            <th scope="col" className="font-medium px-3 py-3">{t("herd.colSex")}</th>
                            <th scope="col" className="font-medium px-3 py-3">{t("lots.colCategory")}</th>
                            <th scope="col" className="font-medium px-3 py-3">{t("herd.colWeight")}</th>
                            <th scope="col" className="font-medium px-3 py-3">{t("lots.colLastWeighing")}</th>
                            <th scope="col" className="font-medium px-3 py-3">{t("lots.colSince")}</th>
                            <th scope="col" className="font-medium px-5 py-3 text-right">{t("common.actions")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-borda">
                          {pageItems.map((animal) => (
                            <tr key={animal.id} className="hover:bg-bege/60">
                              <td className="px-5 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected.has(animal.id)}
                                  onChange={() => toggle(animal.id)}
                                  aria-label={t("lots.selectAnimal", { tag: animal.tag })}
                                />
                              </td>
                              <td className="px-3 py-3">
                                <Link to={`/animais/${animal.id}`} state={originState} className="font-semibold text-texto hover:text-verde">
                                  {animal.tag}
                                </Link>
                              </td>
                              <td className="px-3 py-3 text-texto-suave">
                                <span className="inline-flex items-center gap-1.5">
                                  {animal.sex === "MALE" ? (
                                    <Mars size={16} aria-hidden="true" className="text-[#2E7BD6]" />
                                  ) : (
                                    <Venus size={16} aria-hidden="true" className="text-[#D6478B]" />
                                  )}
                                  {sexLabel[animal.sex]}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-texto-suave">{labelOf(animal.category, animal.sex)}</td>
                              <td className="px-3 py-3 text-texto">
                                {animal.currentWeightKg === null ? "—" : t("units.kgValue", { value: formatNumber(animal.currentWeightKg) })}
                              </td>
                              <td className="px-3 py-3 text-texto-suave">{animal.lastWeighingDate ? formatDate(animal.lastWeighingDate) : "—"}</td>
                              <td className="px-3 py-3 text-texto-suave">{formatDate(animal.since)}</td>
                              <td className="px-5 py-3 text-right">
                                <ActionsMenu
                                  label={t("lots.actionsForAnimal", { tag: animal.tag })}
                                  actions={[
                                    { label: t("lots.openAnimal"), icon: <ChevronRight size={15} aria-hidden="true" />, onSelect: () => open(`/animais/${animal.id}`) },
                                    { label: t("lots.moveTitle"), icon: <ArrowRightLeft size={15} aria-hidden="true" />, onSelect: () => setMoving([animal.id]) },
                                    { label: t("lots.removeFromLot"), icon: <LogOut size={15} aria-hidden="true" />, onSelect: () => setRemoving({ id: animal.id, tag: animal.tag }) },
                                  ]}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={currentPage}
                      totalPages={totalPages}
                      summary={t("lots.showing", { shown: pageItems.length, total: filtered.length })}
                      onPage={setPage}
                    />
                  </>
                )}
              </>
            )}

            {tab === "pesagens" && <LotWeighingsTab lotId={lot.id} />}
            {tab === "manejo" && <LotApplicationsTab lotId={lot.id} />}
            {tab === "movimentacoes" && (
              <div className="p-5">
                <h2 className="font-semibold text-texto">{t("lots.historyTitle")}</h2>
                <p className="text-xs text-texto-suave mb-3">{t("lots.historyHelp")}</p>
                {lot.history.length === 0 ? (
                  <EmptyState icon={<ArrowRightLeft size={22} />} title={t("lots.noMovements")} />
                ) : (
                  <ul className="divide-y divide-borda">
                    {lot.history.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                        <Link to={`/animais/${item.animal.id}`} state={originState} className="font-semibold text-texto hover:text-verde w-24 truncate">
                          {item.animal.tag}
                        </Link>
                        <span className="inline-flex items-center gap-1.5 text-texto">
                          <LogIn size={15} aria-hidden="true" className="text-verde" />
                          {t("lots.entered", { date: formatDate(item.startDate) })}
                        </span>
                        {item.endDate ? (
                          <span className="inline-flex items-center gap-1.5 text-texto">
                            <LogOut size={15} aria-hidden="true" className="text-couro" />
                            {t("lots.left", { date: formatDate(item.endDate) })}
                          </span>
                        ) : (
                          <StatusBadge tone="green">{t("lots.stillHere")}</StatusBadge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Informações do lote */}
        <aside className="flex flex-col gap-5">
          <div className="bg-card border border-borda rounded-xl p-5">
            <p className="flex items-center gap-2 font-semibold text-texto mb-4">
              <ClipboardList size={18} aria-hidden="true" className="text-verde" /> {t("lots.infoTitle")}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-texto-suave">{t("lots.name")}</dt>
              <dd className="text-texto">{lot.name}</dd>
              <dt className="text-texto-suave">{t("lots.description")}</dt>
              <dd className="text-texto">{lot.description ?? "—"}</dd>
              <dt className="text-texto-suave">{t("lots.infoSexes")}</dt>
              <dd className="text-texto">{predominant ?? "—"}</dd>
              <dt className="text-texto-suave">{t("lots.infoCreated")}</dt>
              <dd className="text-texto">{formatDate(createdOn)}</dd>
              <dt className="text-texto-suave">{t("lots.infoFarm")}</dt>
              <dd className="text-texto">{account?.farm.name}</dd>
            </dl>
          </div>
          <div className="bg-verde-claro/70 border border-verde-nevoa rounded-xl p-5">
            <p className="flex items-center gap-2 font-semibold text-verde-escuro mb-2">
              <Leaf size={18} aria-hidden="true" /> {t("lots.tipTitle")}
            </p>
            <p className="text-sm text-texto">{t("lots.tipBody")}</p>
          </div>
          <p className="flex items-start gap-2 text-xs text-texto-leve">
            <Info size={14} aria-hidden="true" className="shrink-0 mt-0.5" /> {t("lots.rulesNote")}
          </p>
        </aside>
      </div>

      {editing && (
        <LotFormModal
          lot={lot}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            showToast(t("lots.saved"));
            load();
          }}
        />
      )}
      {adding && (
        <LotAddAnimalsModal lotId={lot.id} lotName={lot.name} onClose={() => setAdding(false)} onAdded={(result) => afterMove(result, "lots.added")} />
      )}
      {moving && (
        <LotMoveModal
          animalIds={moving}
          currentLotId={lot.id}
          title={t("lots.moveTitle")}
          onClose={() => setMoving(null)}
          onMoved={(result) => afterMove(result, "lots.moved")}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t("lots.removeTitle")}
          confirmLabel={t("lots.removeFromLot")}
          busyLabel={t("common.saving")}
          busy={busy}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        >
          {t("lots.removeBody", { tag: removing.tag, lot: lot.name, date: formatDate(today) })}
        </ConfirmDialog>
      )}
      {deleting && (
        <ConfirmDialog
          title={t("lots.deleteTitle")}
          confirmLabel={t("common.delete")}
          busyLabel={t("common.deleting")}
          busy={busy}
          danger
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
        >
          {t("lots.deleteBody", { name: lot.name })}
        </ConfirmDialog>
      )}
    </>,
  );
}

function LotWeighingsTab({ lotId }: { lotId: string }) {
  const originState = useOriginState();
  const [items, setItems] = useState<LotWeighing[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    setItems(null);
    getLotWeighings(lotId)
      .then(setItems)
      .catch((err) => setError(errorMessage(err, "lots.weighingsLoadFailed")));
  }, [lotId]);
  useEffect(load, [load]);

  return (
    <div className="p-5">
      <h2 className="font-semibold text-texto">{t("lots.weighingsTitle")}</h2>
      <p className="text-xs text-texto-suave mb-3">{t("lots.weighingsHelp")}</p>
      {error ? (
        <LoadError compact message={error} onRetry={load} />
      ) : items === null ? (
        <p className="text-sm text-texto-suave" aria-busy="true">
          {t("common.loading")}
        </p>
      ) : items.length === 0 ? (
        <EmptyState icon={<Scale size={22} />} title={t("lots.noWeighings")} />
      ) : (
        <ul className="divide-y divide-borda">
          {items.map((weighing) => (
            <li key={weighing.id} className="flex items-center gap-4 py-2.5 text-sm">
              <span className="text-texto-suave w-24">{formatDate(weighing.date)}</span>
              <Link to={`/animais/${weighing.animal.id}`} state={originState} className="font-semibold text-texto hover:text-verde w-24 truncate">
                {weighing.animal.tag}
              </Link>
              <span className="text-texto">{t("units.kgValue", { value: formatNumber(Number(weighing.weightKg)) })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LotApplicationsTab({ lotId }: { lotId: string }) {
  const originState = useOriginState();
  const [items, setItems] = useState<LotApplication[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    setItems(null);
    getLotApplications(lotId)
      .then(setItems)
      .catch((err) => setError(errorMessage(err, "lots.applicationsLoadFailed")));
  }, [lotId]);
  useEffect(load, [load]);

  return (
    <div className="p-5">
      <h2 className="font-semibold text-texto">{t("lots.applicationsTitle")}</h2>
      <p className="text-xs text-texto-suave mb-3">{t("lots.applicationsHelp")}</p>
      {error ? (
        <LoadError compact message={error} onRetry={load} />
      ) : items === null ? (
        <p className="text-sm text-texto-suave" aria-busy="true">
          {t("common.loading")}
        </p>
      ) : items.length === 0 ? (
        <EmptyState icon={<Syringe size={22} />} title={t("lots.noApplications")} />
      ) : (
        <ul className="divide-y divide-borda">
          {items.map((application) => (
            <li key={application.id}>
              <Link to={`/aplicacoes/${application.id}`} state={originState} className="flex items-center gap-3 py-3 hover:bg-bege -mx-2 px-2 rounded-lg">
                <ProductTypeIcon type={application.product.type} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-texto truncate">{application.product.name}</span>
                  <span className="block text-xs text-texto-suave">
                    {formatDate(application.date)} · {t("lots.appliedInLot", { inLot: application.animalsInLot, total: application.animalsTotal })}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className="text-texto-leve" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
