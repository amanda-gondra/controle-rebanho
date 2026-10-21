import { useEffect, useMemo, useState, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Check, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listAllAnimals } from "../services/animals.js";
import { listProducts, createApplication, getApplication } from "../services/sanitary.js";
import {
  PRODUCT_TYPES,
  type Animal,
  type Application,
  type DoseUnit,
  type Product,
  type ProductType,
  type Status,
  type Category,
} from "../types/animal.js";
import { sexLabel } from "../types/labels.js";
import { addDaysTo, formatDate, todayInTimeZone } from "../types/format.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { CATEGORY_FILTER_ORDER } from "../types/categories.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";
import { useToast } from "../components/ToastProvider.js";
import { useAuth } from "../components/AuthProvider.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ProductModal } from "../components/ProductModal.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin } from "../navigation/hooks.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";

// Registrar aplicação (F-SAN-01/02/03). Em lote: produto → data → animais
// (só ativos aparecem por padrão) → opcionais (reaplicação, dose, partida,
// observação). Entradas: menu do manejo, ficha do animal (?animal=) e
// lembrete (?reaplicar= — já vem com produto e os animais ainda ativos; ao
// salvar, o lembrete sai da lista — D-40).

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";

const REAPPLY_SHORTCUTS = [30, 60, 90, 180];
const DOSE_UNITS: DoseUnit[] = ["ML", "G", "DOSE"];

export function ApplicationCreate() {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  const [params] = useSearchParams();
  const reapplyFromId = params.get("reaplicar");
  const preselectedAnimal = params.get("animal");
  const { goBack, replaceWith } = useOrigin(preselectedAnimal ? `/animais/${preselectedAnimal}` : "/manejo");
  const showToast = useToast();
  const { account } = useAuth();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const { labelOf, filterLabelOf } = useCategoryLabels();

  // Mesmo identificador em todas as tentativas desta tela: se a internet cair
  // depois de gravar, tentar de novo não grava duas vezes (REQ-INT-02)
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // dados da aplicação
  const [type, setType] = useState<ProductType>("VACCINE");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState<DoseUnit | "">("");

  // reaplicação
  const [needsReapply, setNeedsReapply] = useState(false);
  const [reapplyDate, setReapplyDate] = useState("");

  // seletor de animais
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselectedAnimal ? [preselectedAnimal] : []));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");

  // lembrete de origem (reaplicação)
  const [source, setSource] = useState<Application | null>(null);
  const [sourceError, setSourceError] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  // Falhas de carga (com "Tentar de novo"); o contador refaz a busca
  const [productsError, setProductsError] = useState(false);
  const [animalsError, setAnimalsError] = useState(false);
  const [productsTry, setProductsTry] = useState(0);
  const [animalsTry, setAnimalsTry] = useState(0);
  // Produto que a tela deve deixar escolhido quando a lista do tipo chegar
  const [wantedProduct, setWantedProduct] = useState<string | null>(null);

  // Alterações não salvas: tudo além do que a tela já abre preenchido
  const startSelected = preselectedAnimal ? 1 : 0;
  const dirty =
    !source &&
    (type !== "VACCINE" || productId !== "" || date !== today || notes !== "" || batchNumber !== "" ||
      doseAmount !== "" || doseUnit !== "" || needsReapply || reapplyDate !== "" || selected.size !== startSelected);
  // Vindo de um lembrete, o que já veio preenchido não conta como alteração
  const sourceEdited = !!source && (notes !== "" || batchNumber !== "" || doseAmount !== "" || needsReapply);
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges((dirty || sourceEdited) && !saving);

  // Reaplicação a partir de um lembrete: mesmo produto, animais ainda ativos
  useEffect(() => {
    if (!reapplyFromId) return;
    getApplication(reapplyFromId)
      .then((application) => {
        setSource(application);
        setType(application.product.type);
        setWantedProduct(application.productId);
        setSelected(
          new Set(
            (application.animals ?? [])
              .filter((link) => link.animal?.status === "ACTIVE")
              .map((link) => link.animalId),
          ),
        );
      })
      .catch(() => setSourceError(t("application.reapplyLoadFailed")));
  }, [reapplyFromId]);

  // carrega os produtos ATIVOS do tipo escolhido
  useEffect(() => {
    setProductsError(false);
    listProducts(type)
      .then((data) => {
        setProducts(data);
        setProductId((current) => {
          if (wantedProduct && data.some((product) => product.id === wantedProduct)) return wantedProduct;
          return data.some((product) => product.id === current) ? current : "";
        });
      })
      .catch(() => setProductsError(true));
  }, [type, productsTry, wantedProduct]);

  // carrega os animais conforme os filtros
  useEffect(() => {
    setAnimalsError(false);
    listAllAnimals({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      category: categoryFilter === "ALL" ? undefined : categoryFilter,
      sortBy: "tag",
      order: "asc",
    })
      .then((data) => setAnimals(data))
      .catch(() => setAnimalsError(true));
  }, [statusFilter, categoryFilter, animalsTry]);

  // aplica a busca por brinco (no frontend, instantâneo)
  const visibleAnimals = animals.filter((a) => a.tag.toLowerCase().includes(search.trim().toLowerCase()));

  const product = products.find((p) => p.id === productId);
  const withdrawalEnd = useMemo(
    () => (product?.withdrawalDays != null && date ? addDaysTo(date, product.withdrawalDays) : null),
    [product, date],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const visibleIds = visibleAnimals.map((a) => a.id);
    const allSelected = visibleIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!productId) return setError(t("application.productRequired"));
    if (!date) return setError(t("application.dateRequired"));
    if (needsReapply && !reapplyDate) return setError(t("application.reapplyDateRequired"));
    const dose = doseAmount.trim() === "" ? null : Number(doseAmount.replace(",", "."));
    if ((dose === null) !== (doseUnit === "") || (dose !== null && !(dose > 0))) {
      return setError(t("errors.fieldCodes.DOSE_INCOMPLETE"));
    }
    if (selected.size === 0) return setError(t("application.animalsRequired"));

    setSaving(true);
    try {
      const created = await createApplication({
        productId,
        date,
        reapplyDate: needsReapply ? reapplyDate : undefined,
        notes: notes.trim() || undefined,
        batchNumber: batchNumber.trim() || null,
        doseAmount: dose,
        doseUnit: doseUnit || null,
        animalIds: Array.from(selected),
        ...(source ? { reappliesApplicationId: source.id } : {}),
        idempotencyKey,
      });
      showToast(t("application.createdCount", { count: selected.size }));
      allowLeave();
      // O formulário dá lugar ao detalhe; o "voltar" do detalhe vai para quem abriu
      replaceWith(`/aplicacoes/${created.id}`);
    } catch (err) {
      setError(singleErrorMessage(err));
      setSaving(false);
    }
  }

  const allVisibleSelected = visibleAnimals.length > 0 && visibleAnimals.every((a) => selected.has(a.id));

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("application.newTitle")}
          subtitle={t("application.newSubtitle")}
          backFallback={preselectedAnimal ? `/animais/${preselectedAnimal}` : "/manejo"}
          backLabel={t("application.back")}
        />

        {sourceError && (
          <div className="max-w-2xl mb-4">
            <LoadError compact message={sourceError} onRetry={() => window.location.reload()} />
          </div>
        )}
        {source && (
          <p role="status" className="max-w-2xl mb-4 text-sm bg-verde-claro border border-verde-nevoa rounded-lg px-4 py-3 text-texto">
            {t("application.reapplyFrom", { product: source.product.name, date: formatDate(source.date) })}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Dados da aplicação */}
          <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-6">
            {/* Tipo */}
            <fieldset className="mb-4">
              <legend className="block font-medium text-texto mb-1">{t("application.type")}</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRODUCT_TYPES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                    className={`py-2.5 px-2 rounded-lg border text-sm font-medium cursor-pointer ${
                      type === value ? "bg-verde border-verde text-white" : "bg-card border-borda-chip text-texto-suave"
                    }`}
                  >
                    {t(`product.type.${value}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Produto */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor={`${formId}-product`} className="block font-medium text-texto">
                  {t("application.product")} <span className="text-alerta">*</span>
                </label>
                <button type="button" onClick={() => setCreatingProduct(true)} className="text-sm text-verde font-medium cursor-pointer inline-flex items-center gap-1">
                  <Plus size={15} aria-hidden="true" /> {t("products.new")}
                </button>
              </div>
              {productsError ? (
                <LoadError compact message={t("application.productsLoadFailed")} onRetry={() => setProductsTry((n) => n + 1)} />
              ) : products.length === 0 ? (
                <p className="text-sm text-texto-suave">{t("application.noProducts")}</p>
              ) : (
                <select
                  id={`${formId}-product`}
                  value={productId}
                  onChange={(e) => {
                    setWantedProduct(null);
                    setProductId(e.target.value);
                  }}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
                >
                  <option value="">{t("application.chooseProduct")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {product && (
                <p className="text-sm text-texto-suave mt-1">
                  {withdrawalEnd
                    ? t("product.withdrawal.info", { date: formatDate(withdrawalEnd), days: product.withdrawalDays ?? 0 })
                    : t("product.withdrawal.infoNone")}
                </p>
              )}
            </div>

            {/* Data */}
            <div className="mb-4">
              <label htmlFor={`${formId}-date`} className="block font-medium text-texto mb-1">
                {t("application.date")} <span className="text-alerta">*</span>
              </label>
              <input
                id={`${formId}-date`}
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>

            {/* Reaplicação */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsReapply}
                  onChange={(e) => setNeedsReapply(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-[#3B6D11]"
                />
                <span className="font-medium text-texto">{t("application.needsReapply")}</span>
              </label>
              {needsReapply && (
                <div className="mt-2">
                  <label htmlFor={`${formId}-reapply`} className="block text-sm text-texto-suave mb-1">
                    {t("application.reapplyDate")}
                  </label>
                  <input
                    id={`${formId}-reapply`}
                    type="date"
                    value={reapplyDate}
                    min={date || undefined}
                    onChange={(e) => setReapplyDate(e.target.value)}
                    className="border border-borda rounded-lg px-3 py-2 text-texto"
                  />
                  {/* Atalhos só preenchem a data: o produtor decide o intervalo */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {REAPPLY_SHORTCUTS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        disabled={!date}
                        onClick={() => setReapplyDate(addDaysTo(date, days))}
                        className="px-3 py-1.5 rounded-lg border border-borda-chip text-sm text-texto-suave bg-card cursor-pointer disabled:opacity-50"
                      >
                        {t("application.reapplyIn", { days })}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-texto-leve mt-1">{t("application.reapplyHint")}</p>
                </div>
              )}
            </div>

            {/* Opcionais: dose (só registro), partida, observação */}
            <details className="group" open={doseAmount !== "" || batchNumber !== "" || notes !== ""}>
              <summary className="font-medium text-texto cursor-pointer">{t("application.optionalDetails")}</summary>
              <div className="mt-3">
                <fieldset className="mb-4">
                  <legend className="block font-medium text-texto mb-1">{t("application.dose")}</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="sr-only" htmlFor={`${formId}-dose`}>
                      {t("application.doseAmount")}
                    </label>
                    <input
                      id={`${formId}-dose`}
                      inputMode="decimal"
                      value={doseAmount}
                      onChange={(e) => setDoseAmount(e.target.value)}
                      className="w-28 border border-borda rounded-lg px-3 py-2 text-texto"
                    />
                    <label className="sr-only" htmlFor={`${formId}-unit`}>
                      {t("application.doseUnit")}
                    </label>
                    <select
                      id={`${formId}-unit`}
                      value={doseUnit}
                      onChange={(e) => setDoseUnit(e.target.value as DoseUnit | "")}
                      className="border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
                    >
                      <option value="">{t("application.doseUnit")}</option>
                      {DOSE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {t(`product.doseUnit.${unit}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-texto-leve mt-1">{t("application.doseHelp")}</p>
                </fieldset>
                <div className="mb-4">
                  <label htmlFor={`${formId}-batch`} className="block font-medium text-texto mb-1">
                    {t("application.batchNumber")}
                  </label>
                  <input
                    id={`${formId}-batch`}
                    value={batchNumber}
                    maxLength={50}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-notes`} className="block font-medium text-texto mb-1">
                    {t("application.notes")}
                  </label>
                  <input
                    id={`${formId}-notes`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("application.notesPlaceholder")}
                    className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Seletor de animais */}
          <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="font-medium text-texto">
                {t("application.whichAnimals")}{" "}
                <span className="text-verde" aria-live="polite">
                  {t("application.selectedCount", { count: selected.size })}
                </span>
              </p>
              <button type="button" onClick={toggleAllVisible} className="text-sm text-verde font-medium cursor-pointer">
                {allVisibleSelected ? t("application.clearSelection") : t("application.selectAll")}
              </button>
            </div>

            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("application.searchTag")}
                aria-label={t("application.searchTag")}
                className="w-full bg-bege border border-borda rounded-lg pl-9 pr-3 py-2 text-sm text-texto"
              />
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              <select
                aria-label={t("herd.statusLabel")}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="ACTIVE">{t("application.filterActive")}</option>
                <option value="ALL">{t("application.filterAllStatus")}</option>
                <option value="SOLD">{t("application.filterSold")}</option>
              </select>
              <select
                aria-label={t("herd.category")}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
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

            {animalsError ? (
              <LoadError compact message={t("herd.loadFailed")} onRetry={() => setAnimalsTry((n) => n + 1)} />
            ) : visibleAnimals.length === 0 ? (
              <p className="text-sm text-texto-suave">{t("application.noAnimals")}</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {visibleAnimals.map((a) => {
                  const isSelected = selected.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(a.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left cursor-pointer min-h-11 ${
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
                      <span className="font-medium text-texto w-20 truncate">{a.tag}</span>
                      <span className="text-sm text-texto-suave truncate">
                        {labelOf(a.category, a.sex)} · {sexLabel[a.sex]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-alerta mb-4 max-w-2xl">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 max-w-2xl">
            <button type="button" onClick={goBack} className={buttonClass("secondary")}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving} className={buttonClass("primary")}>
              {saving ? t("application.creating") : t("application.create")}
            </button>
          </div>
        </form>

        {creatingProduct && (
          <ProductModal
            initialType={type}
            onClose={() => setCreatingProduct(false)}
            onSaved={(created) => {
              setCreatingProduct(false);
              showToast(t("products.created"));
              setType(created.type);
              setWantedProduct(created.id);
              setProductsTry((n) => n + 1);
            }}
          />
        )}
        {unsavedDialog}
      </main>
    </div>
  );
}
