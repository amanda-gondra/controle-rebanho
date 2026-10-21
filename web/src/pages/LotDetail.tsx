import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { LotFormModal } from "../components/LotFormModal.js";
import { LotMoveModal } from "../components/LotMoveModal.js";
import { LotAddAnimalsModal } from "../components/LotAddAnimalsModal.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useToast } from "../components/ToastProvider.js";
import { deleteLot, getLot, setLotArchived } from "../services/lots.js";
import type { LotDetail as LotDetailData, LotMoveResult } from "../types/lot.js";
import { formatDate } from "../types/format.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { useOrigin, useOriginState } from "../navigation/hooks.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Detalhe do lote (D-49): quem está nele agora (desde quando), colocar
// animais, mudar marcados de lote ou tirar do lote, e o histórico de entradas e
// saídas. Lote com histórico não se exclui: arquiva (só vazio).

export function LotDetail() {
  const { id } = useParams();
  const { goBack } = useOrigin("/lotes");
  const originState = useOriginState();
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();
  const [lot, setLot] = useState<LotDetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
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
    setMoving(false);
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

  function toggle(animalId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">{content}</main>
    </div>
  );

  if (notFound) {
    return shell(
      <div className="bg-card border border-borda rounded-xl p-8 text-center max-w-lg">
        <p className="text-texto font-medium mb-3">{t("lots.notFound")}</p>
        <Link to="/lotes" className={buttonClass("primary")}>
          {t("lots.backToList")}
        </Link>
      </div>,
    );
  }
  if (!lot) {
    return shell(
      loadError ? (
        <>
          <PageHeader title={t("lots.title")} backFallback="/lotes" backLabel={t("lots.backToList")} />
          <LoadError message={loadError} onRetry={load} />
        </>
      ) : (
        <p className="text-texto-suave" aria-busy="true">
          {t("common.loading")}
        </p>
      ),
    );
  }

  const archived = !!lot.archivedAt;
  const allSelected = lot.animals.length > 0 && lot.animals.every((animal) => selected.has(animal.id));
  const past = lot.history.filter((item) => item.endDate !== null);

  return shell(
    <div className="max-w-4xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3 flex-wrap">
            {lot.name}
            {archived && (
              <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-card border border-borda text-texto-suave">
                {t("lots.archivedBadge")}
              </span>
            )}
          </span>
        }
        subtitle={[t("common.animalsCount", { count: lot.activeCount }), lot.description].filter(Boolean).join(" · ")}
        backFallback="/lotes"
        backLabel={t("lots.backToList")}
        actions={
          <>
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "text-sm px-3 py-2")}>
              <Pencil size={16} aria-hidden="true" /> {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={toggleArchive}
              disabled={busy || (!archived && lot.activeCount > 0)}
              title={!archived && lot.activeCount > 0 ? t("lots.archiveOnlyEmpty") : undefined}
              className={buttonClass("secondary", "text-sm px-3 py-2")}
            >
              {archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}{" "}
              {t(archived ? "lots.unarchive" : "lots.archive")}
            </button>
            <button
              type="button"
              onClick={() => setDeleting(true)}
              disabled={busy || lot.history.length > 0}
              title={lot.history.length > 0 ? t("lots.deleteOnlyUnused") : undefined}
              className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
            >
              <Trash2 size={16} aria-hidden="true" /> {t("common.delete")}
            </button>
          </>
        }
      />

      {!archived && lot.activeCount === 0 && lot.history.length > 0 && (
        <p className="text-sm text-texto-suave mb-4">{t("lots.emptyNowHelp")}</p>
      )}

      <section className="bg-card border border-borda rounded-xl p-4 md:p-6 mb-6" aria-labelledby="lot-animals">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="lot-animals" className="font-medium text-texto">
            {t("lots.animalsNow")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {selected.size > 0 && (
              <button type="button" onClick={() => setMoving(true)} className={buttonClass("secondary", "text-sm px-3 py-2")}>
                <ArrowRightLeft size={16} aria-hidden="true" /> {t("lots.moveSelected", { count: selected.size })}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={archived}
              title={archived ? t("lots.archivedNoEntry") : undefined}
              className={buttonClass("primary", "text-sm px-3 py-2")}
            >
              <Plus size={16} aria-hidden="true" /> {t("lots.addAnimals")}
            </button>
          </div>
        </div>

        {lot.animals.length === 0 ? (
          <p className="text-sm text-texto-suave">{t(archived ? "lots.archivedNoEntry" : "lots.noAnimalsYet")}</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-texto-suave mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(lot.animals.map((animal) => animal.id)))}
              />
              {t("lots.selectAll")}
            </label>
            <ul className="divide-y divide-borda">
              {lot.animals.map((animal) => (
                <li key={animal.id} className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(animal.id)}
                    onChange={() => toggle(animal.id)}
                    aria-label={t("lots.selectAnimal", { tag: animal.tag })}
                    className="w-4 h-4 shrink-0"
                  />
                  <Link
                    to={`/animais/${animal.id}`}
                    state={originState}
                    className="font-medium text-texto hover:text-verde w-24 truncate"
                  >
                    {animal.tag}
                  </Link>
                  <span className="flex-1 min-w-0 text-sm text-texto-suave truncate">
                    {[labelOf(animal.category, animal.sex), sexLabel[animal.sex], animal.breed].filter(Boolean).join(" · ")}
                  </span>
                  <span className="text-xs text-texto-leve shrink-0">{t("lots.since", { date: formatDate(animal.since) })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bg-card border border-borda rounded-xl p-4 md:p-6" aria-labelledby="lot-history">
        <h2 id="lot-history" className="font-medium text-texto mb-1">
          {t("lots.historyTitle")}
        </h2>
        <p className="text-sm text-texto-suave mb-3">{t("lots.historyHelp")}</p>
        {past.length === 0 ? (
          <p className="text-sm text-texto-suave">{t("lots.noPast")}</p>
        ) : (
          <ul className="divide-y divide-borda">
            {past.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <Link to={`/animais/${item.animal.id}`} state={originState} className="font-medium text-texto hover:text-verde w-24 truncate">
                  {item.animal.tag}
                </Link>
                <span className="text-texto-suave">
                  {t("lots.period", { from: formatDate(item.startDate), to: formatDate(item.endDate!) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
        <LotAddAnimalsModal
          lotId={lot.id}
          lotName={lot.name}
          onClose={() => setAdding(false)}
          onAdded={(result) => afterMove(result, "lots.added")}
        />
      )}
      {moving && (
        <LotMoveModal
          animalIds={[...selected]}
          currentLotId={lot.id}
          title={t("lots.moveTitle")}
          onClose={() => setMoving(false)}
          onMoved={(result) => afterMove(result, "lots.moved")}
        />
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
    </div>,
  );
}
