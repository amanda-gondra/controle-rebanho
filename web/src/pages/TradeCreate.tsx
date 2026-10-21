import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin } from "../navigation/hooks.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";
import { Check, Search } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { TradeDealFields, type DealDraft } from "../components/TradeDealFields.js";
import { TradePricesEditor } from "../components/TradePricesEditor.js";
import { NewAnimalsEditor } from "../components/NewAnimalsEditor.js";
import { listAllAnimals } from "../services/animals.js";
import { createTrade, getLastPrices } from "../services/trades.js";
import type { Animal, Category, Status } from "../types/animal.js";
import type { LastPrices, TradeType } from "../types/trade.js";
import type { DraftRow, GroupBy } from "../types/tradeMath.js";
import {
  checkDeal,
  checkNewAnimals,
  checkRows,
  newAnimalPayload,
  profileOfGroup,
  splitApiErrors,
  type NewAnimalDraft,
} from "../types/tradeForm.js";
import { CATEGORY_FILTER_ORDER } from "../types/categories.js";
import { sexLabel, statusLabel } from "../types/labels.js";
import { formatDate, formatMoney, formatNumber, todayInTimeZone } from "../types/format.js";
import type { ApiError } from "../services/api.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Nova compra ou venda (G5 — F-NEG-01/02): assistente em 3 passos.
//   1. Quais animais (seleção igual à da aplicação sanitária)
//   2. A negociação (data, forma de preço, comprador/vendedor)
//   3. Preço por categoria + peso de cada animal (valor ao vivo)
// "Voltar" não perde nada. Salvar grava tudo de uma vez (ou nada).
// Entradas: /negociacoes/nova?tipo=venda|compra&animal=<id> (da ficha).
// Na compra, o passo 1 tem duas formas (D-36): cadastrar os animais comprados
// ali mesmo, linha por linha, ou escolher animais que já estão cadastrados —
// as duas podem entrar na mesma compra.

type Step = 1 | 2 | 3;
type StatusFilter = Status | "ALL";
type PurchaseMode = "new" | "existing";
const isNewKey = (key: string) => key.startsWith("new-");

const STEPS: Step[] = [1, 2, 3];

export function TradeCreate() {
  const showToast = useToast();
  const [params] = useSearchParams();
  const { account } = useAuth();
  const { labelOf, filterLabelOf } = useCategoryLabels();

  const type: TradeType = params.get("tipo") === "compra" ? "PURCHASE" : "SALE";
  const isSale = type === "SALE";
  const preselected = params.get("animal");
  // Sem origem (link direto): volta para o animal escolhido ou para a lista
  const { goBack, replaceWith } = useOrigin(preselected ? `/animais/${preselected}` : "/negociacoes");
  const settings = account?.farm.settings;
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  // Mesmo identificador em todas as tentativas desta tela: se a internet cair
  // depois de gravar, tentar de novo não cria outra negociação (RN-NEG-016)
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [step, setStep] = useState<Step>(1);

  // Passo 1 — animais
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected ? [preselected] : []));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState<Category | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectionError, setSelectionError] = useState("");

  // Passo 1 da compra — animais novos (cadastrados junto com a compra)
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>(preselected ? "existing" : "new");
  const nextNewKey = useRef(0);
  const newKey = () => `new-${(nextNewKey.current += 1)}`;
  const defaultCastrated = settings?.defaultCastrated ?? false;
  const [newRows, setNewRows] = useState<NewAnimalDraft[]>(() =>
    type === "PURCHASE" && !preselected
      ? [{ key: "new-0", tag: "", group: "", castrated: settings?.defaultCastrated ?? false, breed: "" }]
      : [],
  );
  const [showNewProblems, setShowNewProblems] = useState(false);

  // Passo 2 — negociação
  const [deal, setDeal] = useState<DealDraft>(() => ({
    date: today,
    priceUnit: settings?.preferredPriceUnit ?? "PER_KG",
    arrobaBasis: null,
    factor: String(settings?.arrobaLiveFactorKg ?? 30).replace(".", ","),
    counterparty: "",
    notes: "",
  }));
  const [dealErrors, setDealErrors] = useState<Record<string, string>>({});

  // Passo 3 — preços e pesos (o que foi digitado fica guardado por animal)
  const [typed, setTyped] = useState<Record<string, DraftRow>>({});
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [groupPrices, setGroupPrices] = useState<Record<string, string>>({});
  const [lastPrices, setLastPrices] = useState<LastPrices | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showProblems, setShowProblems] = useState(false);

  const [confirming, setConfirming] = useState(false);
  // Aviso de carência (D-12): a API lista os animais; a pessoa decide
  const [withdrawal, setWithdrawal] = useState<{ tag: string; until: string; product: string; appliedOn: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Alterações não salvas: qualquer coisa além do que a tela já abre preenchida
  const dirty =
    step > 1 ||
    selected.size !== (preselected ? 1 : 0) ||
    newRows.some((row) => row.tag.trim() !== "" || row.group !== "" || row.breed.trim() !== "") ||
    newRows.length > (type === "PURCHASE" && !preselected ? 1 : 0) ||
    Object.keys(typed).length > 0 ||
    deal.counterparty.trim() !== "" ||
    deal.notes.trim() !== "" ||
    deal.date !== today;
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges(dirty && !saving);

  // Todos os animais (uma busca); filtros e busca no navegador
  useEffect(() => {
    listAllAnimals({ sortBy: "tag", order: "asc" })
      .then(setAnimals)
      .catch(() => setSelectionError(t("trade.loadAnimalsFailed")));
  }, []);

  const visibleAnimals = animals.filter(
    (animal) =>
      (statusFilter === "ALL" || animal.status === statusFilter || selected.has(animal.id)) &&
      (categoryFilter === "ALL" || animal.category === categoryFilter) &&
      animal.tag.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // Linhas do passo 3: os cadastrados escolhidos (na ordem do brinco) e depois
  // os novos (na ordem digitada), guardando o que já foi digitado em cada um
  const rows: DraftRow[] = useMemo(() => {
    const blankRow = (key: string, animal: DraftRow["animal"]): DraftRow => ({
      key,
      animal,
      liveWeight: "",
      carcassWeight: "",
      individualPrice: null,
      selectionPrice: null,
    });
    const existing = animals
      .filter((animal) => selected.has(animal.id))
      .map(
        (animal) =>
          typed[animal.id] ??
          blankRow(animal.id, {
            id: animal.id,
            tag: animal.tag,
            sex: animal.sex,
            category: animal.category,
            breed: animal.breed,
          }),
      );
    const created = isSale
      ? []
      : newRows
          .filter((row) => row.group !== "")
          .map((row) => {
            // Dados do animal sempre os atuais da linha (pode ter mudado a categoria)
            const animal = {
              id: row.key,
              tag: row.tag.trim(),
              ...profileOfGroup(row.group as Exclude<typeof row.group, "">),
              breed: row.breed.trim() || null,
            };
            return typed[row.key] ? { ...typed[row.key], animal } : blankRow(row.key, animal);
          });
    return [...existing, ...created];
  }, [animals, selected, typed, newRows, isSale]);

  const existingTags = useMemo(() => new Set(animals.map((animal) => animal.tag)), [animals]);
  const newProblems = isSale ? {} : checkNewAnimals(newRows, existingTags);
  const newRowsOk = Object.keys(newProblems).length === 0;
  const animalCount = selected.size + (isSale ? 0 : newRows.length);

  const { pricing } = checkDeal(deal);
  const priceUnit = deal.priceUnit;
  const arrobaBasis = deal.priceUnit === "PER_ARROBA" ? deal.arrobaBasis : null;

  // "Último usado" (só referência — RN-NEG-020)
  useEffect(() => {
    if (priceUnit === "PER_ARROBA" && !arrobaBasis) return;
    getLastPrices(type, priceUnit, arrobaBasis)
      .then(setLastPrices)
      .catch(() => setLastPrices(null));
  }, [type, priceUnit, arrobaBasis]);

  // Quem não pode entrar aparece apagado, com o motivo (o servidor confere de novo)
  function unavailableReason(animal: Animal): string | null {
    if (isSale && animal.status === "DEAD") return t("trade.deadCannotBeSold");
    if (isSale && animal.hasSale) return t("trade.alreadySold");
    if (!isSale && animal.hasPurchase) return t("trade.alreadyPurchased");
    return null;
  }

  // "Selecionar todos" deixa de fora quem não pode entrar
  const selectableVisible = visibleAnimals.filter((animal) => !unavailableReason(animal));

  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((animal) => selected.has(animal.id));

  function toggleAllVisible() {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const animal of selectableVisible) {
        if (allVisibleSelected) next.delete(animal.id);
        else next.add(animal.id);
      }
      return next;
    });
  }

  function goToStep(target: Step) {
    if (target >= 2 && animalCount === 0) {
      setSelectionError(t("trade.animalsRequired"));
      return setStep(1);
    }
    if (target >= 2 && !newRowsOk) {
      setShowNewProblems(true);
      setPurchaseMode("new");
      setSelectionError(t("trade.newAnimals.fixRows"));
      return setStep(1);
    }
    setSelectionError("");
    if (target === 3) {
      const check = checkDeal(deal);
      setDealErrors(check.errors);
      if (!check.pricing) return setStep(2);
    }
    setStep(target);
  }

  function handleRowsChange(next: DraftRow[]) {
    setTyped((previous) => ({ ...previous, ...Object.fromEntries(next.map((row) => [row.key, row])) }));
    setRowErrors({});
  }

  const rowsCheck = pricing ? checkRows(rows, pricing, groupBy, groupPrices) : null;

  function askToSave() {
    setSaveError("");
    setShowProblems(true);
    if (!rowsCheck?.ok) return;
    setConfirming(true);
  }

  async function save(acknowledgeWithdrawal = false) {
    if (!pricing || !rowsCheck) return;
    setSaving(true);
    setSaveError("");
    try {
      const trade = await createTrade({
        type,
        date: deal.date,
        ...(acknowledgeWithdrawal ? { acknowledgeWithdrawal: true } : {}),
        priceUnit: pricing.priceUnit,
        ...(pricing.arrobaBasis ? { arrobaBasis: pricing.arrobaBasis } : {}),
        ...(pricing.arrobaFactorKg ? { arrobaFactorKg: Number(pricing.arrobaFactorKg) } : {}),
        ...(deal.counterparty.trim() ? { counterparty: deal.counterparty.trim() } : {}),
        ...(deal.notes.trim() ? { notes: deal.notes.trim() } : {}),
        idempotencyKey,
        items: rows.map((row, index) => {
          const newRow = isNewKey(row.key) ? newRows.find((candidate) => candidate.key === row.key) : undefined;
          return newRow
            ? { newAnimal: newAnimalPayload(newRow), ...rowsCheck.items[index] }
            : { animalId: row.key, ...rowsCheck.items[index] };
        }),
      });
      const createdCount = rows.filter((row) => isNewKey(row.key)).length;
      const message =
        createdCount > 0
          ? t("trade.savedPurchaseNew", { count: trade.animalCount, created: createdCount })
          : t(isSale ? "trade.savedSale" : "trade.savedPurchase", { count: trade.animalCount });
      const replaced = trade.replacedWeighings ?? 0;
      showToast(replaced > 0 ? `${message} ${t("trade.replacedWeighings", { count: replaced })}` : message);
      allowLeave();
      // O formulário dá lugar ao detalhe; o "voltar" do detalhe vai para quem abriu o formulário
      replaceWith(`/negociacoes/${trade.id}`);
    } catch (err) {
      setSaving(false);
      setConfirming(false);
      const apiError = err as ApiError;
      if (apiError?.code === "WITHDRAWAL_WARNING") {
        setWithdrawal(
          (apiError.errors ?? []).map((item) => ({
            tag: String(item.params?.tag ?? ""),
            until: String(item.params?.until ?? ""),
            product: String(item.params?.product ?? ""),
            appliedOn: String(item.params?.appliedOn ?? ""),
          })),
        );
        return;
      }
      setWithdrawal(null);
      const split = splitApiErrors(err, rows.map((row) => row.key));
      setRowErrors(split.rows);
      setDealErrors(split.deal);
      if (Object.keys(split.deal).length > 0) setStep(2);
      // Brinco ou categoria de um animal novo: volta para a lista dos novos
      if (Object.keys(split.rows).some(isNewKey)) {
        setShowNewProblems(true);
        setPurchaseMode("new");
        setStep(1);
      }
      setSaveError(
        Object.keys(split.rows).length > 0
          ? t("trade.rowsHaveProblems", { count: Object.keys(split.rows).length })
          : errorMessage(err, "trade.saveFailed"),
      );
    }
  }

  const stepTitle = (value: Step) => t(`trade.step${value}`);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t(isSale ? "trade.newSaleTitle" : "trade.newPurchaseTitle")}
          subtitle={t(isSale ? "trade.newSaleSubtitle" : "trade.newPurchaseSubtitle")}
          backFallback={preselected ? `/animais/${preselected}` : "/negociacoes"}
        />

        {/* Passos */}
        <ol className="flex flex-wrap gap-2 mb-6 max-w-4xl" aria-label={t("trade.stepsLabel")}>
          {STEPS.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-current={step === value ? "step" : undefined}
                onClick={() => goToStep(value)}
                className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer ${
                  step === value
                    ? "bg-verde text-white border-verde"
                    : "bg-card text-texto-suave border-borda-chip"
                }`}
              >
                {value}. {stepTitle(value)}
              </button>
            </li>
          ))}
        </ol>

        <div className="max-w-4xl">
          {step === 1 && (
            <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
              {!isSale && (
                <>
                  <p className="font-medium text-texto mb-2">
                    {t("trade.newAnimals.purchaseTitle")}{" "}
                    <span className="text-verde">{t("trade.inThisPurchase", { count: animalCount })}</span>
                  </p>
                  <div role="radiogroup" aria-label={t("trade.newAnimals.purchaseTitle")} className="flex flex-wrap gap-2 mb-4">
                    {(["new", "existing"] as PurchaseMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={purchaseMode === mode}
                        onClick={() => setPurchaseMode(mode)}
                        className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${
                          purchaseMode === mode
                            ? "bg-verde-claro border-verde text-verde-escuro font-medium"
                            : "bg-card border-borda-chip text-texto-suave"
                        }`}
                      >
                        {mode === "new"
                          ? t("trade.newAnimals.modeNew", { count: newRows.length })
                          : t("trade.newAnimals.modeExisting", { count: selected.size })}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {!isSale && purchaseMode === "new" ? (
                <NewAnimalsEditor
                  rows={newRows}
                  onChange={(next) => {
                    setNewRows(next);
                    setRowErrors({});
                  }}
                  newKey={newKey}
                  defaultCastrated={defaultCastrated}
                  problems={{ ...rowErrors, ...newProblems }}
                  showProblems={showNewProblems || Object.keys(rowErrors).some(isNewKey)}
                />
              ) : (
                <>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="font-medium text-texto">
                    {t(isSale ? "trade.whichAnimalsSale" : "trade.whichAnimalsPurchase")}{" "}
                    <span className="text-verde">{t("trade.selectedCount", { count: selected.size })}</span>
                  </p>
                  <button type="button" onClick={toggleAllVisible} className="text-sm text-verde font-medium cursor-pointer">
                    {allVisibleSelected ? t("trade.clearSelection") : t("trade.selectAll")}
                  </button>
                </div>
                {!isSale && <p className="text-sm text-texto-suave mb-3">{t("trade.purchaseExistingHint")}</p>}

                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("trade.searchTag")}
                    aria-label={t("trade.searchTag")}
                    className="w-full bg-bege border border-borda rounded-lg pl-9 pr-3 py-2 text-sm text-texto"
                  />
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <select
                    aria-label={t("trade.filterStatus")}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
                  >
                    <option value="ACTIVE">{t("application.filterActive")}</option>
                    <option value="ALL">{t("application.filterAllStatus")}</option>
                    <option value="SOLD">{t("application.filterSold")}</option>
                  </select>
                  <select
                    aria-label={t("trade.filterCategory")}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as Category | "ALL")}
                    className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
                  >
                    <option value="ALL">{t("application.allCategories")}</option>
                    {CATEGORY_FILTER_ORDER.map((value) => (
                      <option key={value} value={value}>
                        {filterLabelOf(value)}
                      </option>
                    ))}
                  </select>
                </div>

                {visibleAnimals.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t("application.noAnimals")}</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {visibleAnimals.map((animal) => {
                      const isSelected = selected.has(animal.id);
                      const blocked = unavailableReason(animal);
                      return (
                        <button
                          key={animal.id}
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-disabled={!!blocked && !isSelected}
                          onClick={() => (blocked && !isSelected ? undefined : toggle(animal.id))}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left ${
                            isSelected
                              ? "bg-verde-claro border-verde cursor-pointer"
                              : blocked
                                ? "bg-bege border-borda opacity-60 cursor-not-allowed"
                                : "bg-card border-borda-chip cursor-pointer"
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 ${
                              isSelected ? "bg-verde border-verde text-white" : "border-borda-chip"
                            }`}
                          >
                            {isSelected && <Check size={14} />}
                          </span>
                          <span className="font-medium text-texto w-20 shrink-0">{animal.tag}</span>
                          <span className="text-sm text-texto-suave truncate">
                            {[labelOf(animal.category, animal.sex), sexLabel[animal.sex], animal.breed]
                              .filter(Boolean)
                              .join(" · ")}
                            {animal.currentWeightKg != null &&
                              ` · ${t("units.kgValue", { value: formatNumber(animal.currentWeightKg) })}`}
                          </span>
                          {(blocked || animal.status !== "ACTIVE") && (
                            <span className="ml-auto text-xs text-texto-leve shrink-0">
                              {blocked ?? statusLabel[animal.status]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                </>
              )}
              {selectionError && (
                <p role="alert" className="text-sm text-alerta mt-3">
                  {selectionError}
                </p>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
              <TradeDealFields
                type={type}
                value={deal}
                onChange={(patch) => {
                  setDeal((previous) => ({ ...previous, ...patch }));
                  setDealErrors({});
                }}
                errors={dealErrors}
                maxDate={today}
              />
            </section>
          )}

          {step === 3 && pricing && (
            <TradePricesEditor
              type={type}
              pricing={pricing}
              rows={rows}
              onRowsChange={handleRowsChange}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              groupPrices={groupPrices}
              onGroupPricesChange={setGroupPrices}
              lastPrices={lastPrices}
              rowErrors={rowErrors}
              showProblems={showProblems}
            />
          )}

          {saveError && (
            <p role="alert" className="text-sm text-alerta mt-4">
              {saveError}
            </p>
          )}

          {/* Navegação do assistente */}
          <div className="flex flex-wrap justify-between gap-3 mt-6">
            <button
              type="button"
              onClick={() => (step === 1 ? goBack() : setStep((step - 1) as Step))}
              className={buttonClass("secondary")}
            >
              {step === 1 ? t("common.cancel") : t("trade.previous")}
            </button>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => goToStep((step + 1) as Step)}
                className={buttonClass("primary")}
              >
                {t("trade.next")}
              </button>
            ) : (
              <button
                type="button"
                onClick={askToSave}
                disabled={saving}
                className={buttonClass("primary")}
              >
                {t(isSale ? "trade.registerSale" : "trade.registerPurchase")}
              </button>
            )}
          </div>
        </div>

        {confirming && rowsCheck && (
          <ConfirmDialog
            title={t(isSale ? "trade.confirmSaleTitle" : "trade.confirmPurchaseTitle")}
            confirmLabel={t(isSale ? "trade.registerSale" : "trade.registerPurchase")}
            busyLabel={t(isSale ? "trade.savingSale" : "trade.savingPurchase")}
            busy={saving}
            onConfirm={() => save()}
            onClose={() => setConfirming(false)}
          >
            <p>
              {rowsCheck.awaitingCarcass > 0
                ? t(isSale ? "trade.confirmSalePending" : "trade.confirmPurchasePending", {
                    count: rows.length,
                    total: formatMoney(Number(rowsCheck.total)),
                  })
                : t(isSale ? "trade.confirmSale" : "trade.confirmPurchase", {
                    count: rows.length,
                    total: formatMoney(Number(rowsCheck.total)),
                  })}
            </p>
            {rowsCheck.awaitingCarcass > 0 && rowsCheck.awaitingCarcass < rows.length && (
              <p>{t("trade.confirmPending", { count: rowsCheck.awaitingCarcass })}</p>
            )}
            {isSale && <p>{t("trade.confirmSaleEffects")}</p>}
            {!isSale && rows.some((row) => isNewKey(row.key)) && (
              <p>{t("trade.confirmNewAnimals", { count: rows.filter((row) => isNewKey(row.key)).length })}</p>
            )}
          </ConfirmDialog>
        )}
        {withdrawal && (
          <ConfirmDialog
            title={t("trade.withdrawalTitle")}
            confirmLabel={t("trade.withdrawalConfirm")}
            cancelLabel={t("trade.withdrawalBack")}
            busyLabel={t("trade.savingSale")}
            busy={saving}
            onConfirm={() => save(true)}
            onClose={() => {
              setWithdrawal(null);
              setStep(1);
            }}
          >
            <p>{t("trade.withdrawalBody", { count: withdrawal.length })}</p>
            <ul className="list-disc pl-5">
              {withdrawal.map((item) => (
                <li key={item.tag}>
                  {t("trade.withdrawalLine", {
                    tag: item.tag,
                    until: item.until ? formatDate(item.until) : "",
                    product: item.product,
                    appliedOn: item.appliedOn ? formatDate(item.appliedOn) : "",
                  })}
                </li>
              ))}
            </ul>
            <p>{t("trade.withdrawalCheck")}</p>
          </ConfirmDialog>
        )}
        {unsavedDialog}
      </main>
    </div>
  );
}
