import { useEffect, useId, useRef, useState } from "react";
import { Pencil, Scale, Trash2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { EditWeighingModal } from "../components/EditWeighingModal.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { createWeighing, deleteWeighing, listAnimals } from "../services/animals.js";
import type { ApiError } from "../services/api.js";
import type { Animal, Weighing } from "../types/animal.js";
import { formatDate, formatNumber, todayInTimeZone } from "../types/format.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { useOpen, useOrigin } from "../navigation/hooks.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Pesagem em sequência (D-14, F-PES-02): no curral, a data é informada uma
// vez; depois brinco → peso → "Salvar e próximo". Cada pesagem é GRAVADA NA
// HORA (RN-PES-010): se a internet cair no 37º, os 36 anteriores já estão
// salvos e o 37º pode ser reenviado sem digitar de novo. Brinco sem
// diferenciar maiúsculas e também pelo brinco antigo (D-19/D-29).

// `query` = o brinco que foi buscado (para dizer se achou pelo brinco antigo)
type Found = { animal: Animal; query: string } | { notFound: string } | { exited: Animal } | null;
type Saved = { weighing: Weighing; tag: string };

export function WeighingSession() {
  const id = useId();
  const open = useOpen();
  const { goBack } = useOrigin("/");
  const showToast = useToast();
  const { account } = useAuth();
  const { labelOf } = useCategoryLabels();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  const [date, setDate] = useState(today);
  const [started, setStarted] = useState(false);
  const [tag, setTag] = useState("");
  const [found, setFound] = useState<Found>(null);
  const [searching, setSearching] = useState(false);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [editing, setEditing] = useState<Saved | null>(null);
  const [deleting, setDeleting] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const tagInput = useRef<HTMLInputElement>(null);
  const weightInput = useRef<HTMLInputElement>(null);
  // O animal na tela agora (para a resposta de uma gravação antiga não apagar o próximo)
  const currentAnimalId = useRef<string | null>(null);
  useEffect(() => {
    currentAnimalId.current = found && "animal" in found ? found.animal.id : null;
  }, [found]);

  // Só o que está digitado e NÃO salvo conta como alteração
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges((tag.trim() !== "" || weight.trim() !== "") && !saving);

  useEffect(() => {
    if (started) tagInput.current?.focus();
  }, [started]);

  async function findAnimal(e?: React.FormEvent) {
    e?.preventDefault();
    const wanted = tag.trim();
    if (!wanted) return;
    setError("");
    setSearching(true);
    try {
      const page = await listAnimals({ tag: wanted, pageSize: 5 });
      // Brinco ATUAL tem preferência sobre um brinco antigo de outro animal
      const exact = page.items.find((animal) => animal.tag.toLocaleLowerCase() === wanted.toLocaleLowerCase()) ?? page.items[0];
      if (!exact) setFound({ notFound: wanted });
      else if (exact.status !== "ACTIVE") setFound({ exited: exact });
      else {
        setFound({ animal: exact, query: wanted });
        setWeight("");
        setTimeout(() => weightInput.current?.focus(), 0);
      }
    } catch (err) {
      setError(errorMessage(err, "weighingSession.searchFailed"));
    } finally {
      setSearching(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!found || !("animal" in found)) return;
    const value = Number(weight.replace(",", "."));
    if (!weight.trim() || !(value > 0)) return setError(t("weighing.weightRequired"));
    setError("");
    setSaving(true);
    const savedAnimalId = found.animal.id;
    try {
      const weighing = await createWeighing(found.animal.id, { date, weightKg: value });
      setSaved((previous) => [{ weighing, tag: found.animal.tag }, ...previous]);
      // Só limpa se a pessoa ainda não começou o próximo (digitou rápido
      // enquanto o servidor respondia): nada do próximo animal se perde
      setFound((current) => (current && "animal" in current && current.animal.id === savedAnimalId ? null : current));
      setTag((current) => (current.trim().toLocaleLowerCase() === found.query.toLocaleLowerCase() ? "" : current));
      if (currentAnimalId.current === savedAnimalId) {
        setWeight("");
        tagInput.current?.focus();
      }
    } catch (err) {
      const apiError = err as ApiError;
      // Sem conexão: brinco e peso continuam na tela para tentar de novo
      setError(
        apiError?.code === "DUPLICATE_WEIGHING_DATE"
          ? t("weighingSession.alreadyWeighed", { tag: found.animal.tag })
          : apiError?.status === 0 || apiError?.code === undefined
            ? t("weighingSession.notSaved", { tag: found.animal.tag })
            : errorMessage(err),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteWeighing(deleting.weighing.animalId, deleting.weighing.id);
      setSaved((previous) => previous.filter((item) => item.weighing.id !== deleting.weighing.id));
      setDeleting(null);
    } catch (err) {
      showToast(errorMessage(err, "animalDetail.weighingDeleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    if (saved.length > 0) showToast(t("weighingSession.summary", { count: saved.length, date: formatDate(date) }));
    allowLeave();
    goBack();
  }

  const animal = found && "animal" in found ? found.animal : null;

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader title={t("weighingSession.title")} subtitle={t("weighingSession.subtitle")} backFallback="/" />

        <div className="max-w-xl">
          {!started ? (
            <form
              className="bg-card border border-borda rounded-xl p-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (date) setStarted(true);
              }}
            >
              <label htmlFor={`${id}-date`} className="block font-medium text-texto mb-1">
                {t("weighingSession.date")}
              </label>
              <input
                id={`${id}-date`}
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-borda rounded-lg px-3 py-3 text-lg text-texto mb-4"
              />
              <button type="submit" disabled={!date} className={buttonClass("primary", "w-full py-3 text-lg")}>
                {t("weighingSession.start")}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-texto-suave mb-3">
                {t("weighingSession.dateLine", { date: formatDate(date) })}{" "}
                <button type="button" onClick={() => setStarted(false)} className="text-verde font-medium underline cursor-pointer">
                  {t("weighingSession.changeDate")}
                </button>
              </p>

              <div className="bg-card border border-borda rounded-xl p-5">
                {/* Brinco */}
                <form onSubmit={findAnimal} noValidate>
                  <label htmlFor={`${id}-tag`} className="block font-medium text-texto mb-1">
                    {t("weighingSession.tag")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={`${id}-tag`}
                      ref={tagInput}
                      value={tag}
                      onChange={(e) => {
                        setTag(e.target.value);
                        setFound(null);
                        setError("");
                      }}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={50}
                      enterKeyHint="search"
                      className="flex-1 min-w-0 border border-borda rounded-lg px-3 py-3 text-xl text-texto"
                    />
                    <button type="submit" disabled={!tag.trim() || searching} className={buttonClass("secondary", "py-3")}>
                      {searching ? t("common.loading") : t("weighingSession.find")}
                    </button>
                  </div>
                </form>

                <div aria-live="polite" className="mt-3 min-h-6">
                  {found && "notFound" in found && (
                    <p className="text-texto">
                      {t("weighingSession.notFound", { tag: found.notFound })}{" "}
                      <button
                        type="button"
                        onClick={() => open(`/animais/novo?brinco=${encodeURIComponent(found.notFound)}`)}
                        className="text-verde font-medium underline cursor-pointer"
                      >
                        {t("weighingSession.createAnimal")}
                      </button>
                    </p>
                  )}
                  {found && "exited" in found && (
                    <p className="text-texto">
                      {t("weighingSession.exited", {
                        tag: found.exited.tag,
                        date: found.exited.exitDate ? formatDate(found.exited.exitDate) : "",
                      })}
                    </p>
                  )}
                  {animal && (
                    <p className="text-texto">
                      <strong>{animal.tag}</strong> · {labelOf(animal.category, animal.sex)}
                      {found && "animal" in found && animal.tag.toLocaleLowerCase() !== found.query.toLocaleLowerCase() && (
                        <> · {t("herd.foundByOldTag", { tag: found.query })}</>
                      )}
                      <br />
                      <span className="text-sm text-texto-suave">
                        {animal.currentWeightKg != null && animal.lastWeighingDate
                          ? t("weighingSession.last", {
                              weight: formatNumber(animal.currentWeightKg),
                              date: formatDate(animal.lastWeighingDate),
                            })
                          : t("herd.noWeighing")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Peso */}
                {animal && (
                  <form onSubmit={save} noValidate className="mt-3">
                    <label htmlFor={`${id}-weight`} className="block font-medium text-texto mb-1">
                      {t("weighing.weight")}
                    </label>
                    <input
                      id={`${id}-weight`}
                      ref={weightInput}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      inputMode="decimal"
                      enterKeyHint="done"
                      className="w-full border border-borda rounded-lg px-3 py-3 text-2xl text-texto mb-3"
                    />
                    <button type="submit" disabled={saving} className={buttonClass("primary", "w-full py-3 text-lg")}>
                      <Scale size={20} aria-hidden="true" /> {saving ? t("common.saving") : t("weighingSession.saveNext")}
                    </button>
                  </form>
                )}

                {error && (
                  <p role="alert" className="text-sm text-alerta mt-3">
                    {error}
                  </p>
                )}
              </div>

              {/* Pesados hoje */}
              <section className="bg-card border border-borda rounded-xl p-5 mt-5" aria-labelledby={`${id}-done`}>
                <h2 id={`${id}-done`} className="font-medium text-texto mb-2">
                  {t("weighingSession.weighedCount", { count: saved.length })}
                </h2>
                {saved.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t("weighingSession.noneYet")}</p>
                ) : (
                  <ul className="divide-y divide-borda">
                    {saved.map((item) => (
                      <li key={item.weighing.id} className="flex items-center gap-3 py-2.5">
                        <span className="font-medium text-texto w-24 truncate">{item.tag}</span>
                        <span className="flex-1 text-texto">
                          {t("units.kgValue", { value: formatNumber(Number(item.weighing.weightKg)) })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          aria-label={t("weighingSession.editOne", { tag: item.tag })}
                          className="p-2 text-texto-leve hover:text-verde cursor-pointer"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(item)}
                          aria-label={t("weighingSession.deleteOne", { tag: item.tag })}
                          className="p-2 text-texto-leve hover:text-alerta cursor-pointer"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex justify-end mt-5">
                <button type="button" onClick={finish} className={buttonClass("secondary")}>
                  {t("weighingSession.finish")}
                </button>
              </div>
            </>
          )}
        </div>

        {editing && (
          <EditWeighingModal
            animalId={editing.weighing.animalId}
            weighing={editing.weighing}
            onClose={() => setEditing(null)}
            onSaved={(updated) => {
              setSaved((previous) =>
                previous.map((item) => (item.weighing.id === editing.weighing.id ? { ...item, weighing: updated ?? item.weighing } : item)),
              );
              setEditing(null);
            }}
          />
        )}
        {deleting && (
          <ConfirmDialog
            title={t("animalDetail.deleteWeighingTitle")}
            confirmLabel={t("common.delete")}
            busyLabel={t("common.deleting")}
            busy={busy}
            danger
            onConfirm={confirmDelete}
            onClose={() => setDeleting(null)}
          >
            {t("animalDetail.deleteWeighingBody", {
              date: formatDate(deleting.weighing.date),
              weight: t("units.kgValue", { value: formatNumber(Number(deleting.weighing.weightKg)) }),
            })}
          </ConfirmDialog>
        )}
        {unsavedDialog}
      </main>
    </div>
  );
}
