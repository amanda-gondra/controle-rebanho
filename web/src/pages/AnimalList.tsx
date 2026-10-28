import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Tag,
  Mars,
  Venus,
  Scale,
  Download,
} from "lucide-react";
import { listAllAnimals, listAnimals, MAX_PICKER_ANIMALS } from "../services/animals.js";
import { downloadCsv, toCsv } from "../types/csv.js";
import { originText } from "../types/history.js";
import { listLots } from "../services/lots.js";
import type { Animal, AnimalPage, Status, Category } from "../types/animal.js";
import type { Lot } from "../types/lot.js";
import {
  sexLabel,
  statusLabel,
  statusStyle,
  statusDotStyle,
  sexIconStyle,
} from "../types/labels.js";
import { formatAge, formatDate, formatMonthYear, formatNumber } from "../types/format.js";
import { Sidebar } from "../components/Sidebar.js";
import { AnimalActionsMenu } from "../components/AnimalActionsMenu.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { useToast } from "../components/ToastProvider.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { CATEGORY_FILTER_ORDER } from "../types/categories.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { LoadError } from "../components/LoadError.js";
import { PageHeader } from "../components/PageHeader.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { buildParams, pageWindow, readChoice, readPage, readText } from "../navigation/listParams.js";

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";
type SortValue = "tag-asc" | "tag-desc" | "createdAt-desc" | "createdAt-asc";

const PAGE_SIZE = 20;

const STATUS_TABS: StatusFilter[] = ["ALL", "ACTIVE", "SOLD", "DEAD"];
const CATEGORY_VALUES: CategoryFilter[] = ["ALL", ...CATEGORY_FILTER_ORDER];
const SORT_VALUES: SortValue[] = ["createdAt-desc", "createdAt-asc", "tag-asc", "tag-desc"];
const DEFAULTS = { q: "", status: "ALL", category: "ALL", lot: "", sort: "createdAt-desc", page: 1 };

// Achou pelo brinco antigo? (a tela mostra qual — D-19)
function matchedOldTag(animal: Animal, search: string) {
  const wanted = search.trim().toLocaleLowerCase();
  if (!wanted || animal.tag.toLocaleLowerCase().includes(wanted)) return null;
  return animal.previousTags?.find((tag) => tag.toLocaleLowerCase().includes(wanted)) ?? null;
}

export function AnimalList() {
  const open = useOpen();
  const originState = useOriginState();
  const showToast = useToast();

  // Lista paginada, filtrada e buscada NO SERVIDOR (F-16): 20 por página,
  // contadores do rebanho inteiro, busca também pelo brinco antigo (D-19)
  const { labelOf, filterLabelOf } = useCategoryLabels();
  const [data, setData] = useState<AnimalPage | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // Busca, filtros, ordenação e página ficam no ENDEREÇO: abrir um animal e
  // voltar devolve a lista como estava (navigation/listParams.ts)
  const [params, setParams] = useSearchParams();
  const search = readText(params, "q");
  const status = readChoice(params, "status", STATUS_TABS, "ALL");
  const category = readChoice(params, "category", CATEGORY_VALUES, "ALL");
  const lot = readText(params, "lot");
  const sort = readChoice(params, "sort", SORT_VALUES, "createdAt-desc");
  const page = readPage(params);
  const [showFilters, setShowFilters] = useState(true);
  const [deleting, setDeleting] = useState<Animal | null>(null);
  // O campo de busca responde na hora; a busca no servidor espera a pessoa parar de digitar
  const [searchInput, setSearchInput] = useState(search);

  // Mudar um filtro volta para a 1ª página; `replace` para não encher o
  // histórico a cada letra digitada
  const update = useCallback(
    (changes: Partial<typeof DEFAULTS>) => {
      const next = { q: search, status, category, lot, sort, page: 1, ...changes };
      setParams(buildParams(next, DEFAULTS), { replace: true });
    },
    [search, status, category, lot, sort, setParams],
  );
  const setPage = (value: number) => update({ page: value });
  const filtersActive = search !== "" || status !== "ALL" || category !== "ALL" || lot !== "";

  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => update({ q: searchInput }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  useEffect(() => {
    listLots()
      .then(setLots)
      .catch(() => setLots([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    const [sortBy, order] = sort.split("-") as ["tag" | "createdAt", "asc" | "desc"];
    listAnimals({
      q: search || undefined,
      status: status === "ALL" ? undefined : status,
      category: category === "ALL" ? undefined : category,
      lotId: lot || undefined,
      sortBy,
      order,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setLoadError(errorMessage(err, "herd.loadFailed")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, status, category, lot, sort, page, attempt]);

  const reload = () => setAttempt((n) => n + 1);

  // Baixar a lista (D-46, parte "planilha"): os animais do filtro atual, todas
  // as páginas, com os nomes da fazenda. Vem do servidor (só a fazenda da sessão).
  const [exporting, setExporting] = useState(false);
  async function exportCsv() {
    setExporting(true);
    try {
      const [sortBy, order] = sort.split("-") as ["tag" | "createdAt", "asc" | "desc"];
      const animals = await listAllAnimals({
        q: search || undefined,
        status: status === "ALL" ? undefined : status,
        category: category === "ALL" ? undefined : category,
        lotId: lot || undefined,
        sortBy,
        order,
      });
      const kg = (value: number | null | undefined) => (value == null ? "" : formatNumber(value, { useGrouping: false }));
      const day = (value: string | null | undefined) => (value ? formatDate(value) : "");
      const birth = (animal: Animal) =>
        !animal.birthDate || animal.birthPrecision === "UNKNOWN"
          ? ""
          : animal.birthPrecision === "MONTH_YEAR"
            ? formatMonthYear(animal.birthDate)
            : formatDate(animal.birthDate);
      const csv = toCsv(
        [
          t("herd.csv.tag"),
          t("herd.csv.sex"),
          t("herd.csv.category"),
          t("herd.csv.castrated"),
          t("herd.csv.breed"),
          t("herd.csv.birth"),
          t("herd.csv.status"),
          t("herd.csv.exitDate"),
          t("herd.csv.lot"),
          t("herd.csv.origin"),
          t("herd.csv.entryDate"),
          t("herd.csv.lastWeight"),
          t("herd.csv.lastWeighing"),
        ],
        animals.map((animal) => [
          animal.tag,
          sexLabel[animal.sex],
          labelOf(animal.category, animal.sex),
          animal.castrated === null ? "" : t(animal.castrated ? "herd.csv.yes" : "herd.csv.no"),
          animal.breed,
          birth(animal),
          statusLabel[animal.status],
          day(animal.exitDate),
          animal.lot?.name ?? "",
          originText(animal.origin),
          day(animal.entryDate),
          kg(animal.currentWeightKg),
          day(animal.lastWeighingDate),
        ]),
      );
      downloadCsv(t("herd.csv.fileName", { date: new Date().toISOString().slice(0, 10) }), csv);
      showToast(
        animals.length >= MAX_PICKER_ANIMALS
          ? t("herd.csv.truncated", { count: animals.length })
          : t("herd.csv.done", { count: animals.length }),
      );
    } catch (err) {
      showToast(errorMessage(err, "herd.csv.failed"));
    } finally {
      setExporting(false);
    }
  }
  const counts = data?.counts ?? { ALL: 0, ACTIVE: 0, SOLD: 0, DEAD: 0 };
  const total = data?.total ?? 0;
  const pageItems = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;

  // Endereço com página que não existe mais: vai para a última
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <PageHeader
          title={t("herd.title")}
          actions={
            <>
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting || total === 0}
                className={buttonClass("secondary")}
              >
                <Download size={16} aria-hidden="true" /> {exporting ? t("herd.csv.exporting") : t("herd.csv.action")}
              </button>
              <button type="button" onClick={() => open("/pesagens")} className={buttonClass("secondary")}>
                <Scale size={16} aria-hidden="true" /> {t("weighingSession.action")}
              </button>
              <button type="button" onClick={() => open("/animais/novo")} className={buttonClass("primary")}>
                <Plus size={18} aria-hidden="true" /> {t("herd.addAnimal")}
              </button>
            </>
          }
        >
            <div className="flex items-center gap-4 mt-1.5 text-sm text-texto-suave flex-wrap">
              <span className="flex items-center gap-1.5">
                <img src="/logo.png" alt="" className="w-4 h-4 opacity-60" />
                {t("herd.countAll", { count: counts.ALL })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.ACTIVE}`} />
                {t("herd.countActive", { count: counts.ACTIVE })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.SOLD}`} />
                {t("herd.countSold", { count: counts.SOLD })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.DEAD}`} />
                {t("herd.countDead", { count: counts.DEAD })}
              </span>
            </div>
        </PageHeader>

        {/* Busca + botão Filtros */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-leve"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("herd.searchPlaceholder")}
              aria-label={t("herd.searchPlaceholder")}
              className="w-full bg-card border border-borda rounded-xl pl-11 pr-4 py-2.5 text-texto placeholder:text-texto-leve"
            />
          </div>
          <button
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 bg-card border border-borda rounded-xl px-4 py-2.5 text-sm text-texto-suave font-medium cursor-pointer shrink-0"
          >
            <SlidersHorizontal size={16} /> {t("herd.filters")}
            <ChevronDown
              size={15}
              className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Linha de filtros (abas + selects) */}
        {showFilters && (
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {STATUS_TABS.map((value) => {
                const label = t(`herd.tab${value}`);
                const active = status === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ status: value })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border cursor-pointer ${
                      active
                        ? "bg-verde border-verde text-white"
                        : "bg-card border-borda-chip text-texto-suave"
                    }`}
                  >
                    {label}
                    <span
                      className={`text-xs px-1.5 rounded-full ${
                        active ? "bg-white/20" : "bg-bege"
                      }`}
                    >
                      {counts[value]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-texto-suave">
                {t("herd.category")}
                <select
                  value={category}
                  onChange={(e) => update({ category: e.target.value as CategoryFilter })}
                  className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
                >
                  <option value="ALL">{t("herd.allCategories")}</option>
                  {CATEGORY_FILTER_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {filterLabelOf(value)}
                    </option>
                  ))}
                </select>
              </label>

              {lots.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-texto-suave">
                  {t("herd.lot")}
                  <select
                    value={lot}
                    onChange={(e) => update({ lot: e.target.value })}
                    className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
                  >
                    <option value="">{t("herd.allLots")}</option>
                    <option value="none">{t("herd.noLot")}</option>
                    {lots.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-texto-suave">
                {t("herd.sortBy")}
                <select
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value as SortValue })}
                  className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
                >
                  <option value="createdAt-desc">{t("herd.sortNewest")}</option>
                  <option value="createdAt-asc">{t("herd.sortOldest")}</option>
                  <option value="tag-asc">{t("herd.sortTagAsc")}</option>
                  <option value="tag-desc">{t("herd.sortTagDesc")}</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {loading && !data ? (
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        ) : loadError ? (
          <LoadError message={loadError} onRetry={reload} />
        ) : counts.ALL === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-12 text-center max-w-xl mx-auto mt-4">
            <div className="w-16 h-16 rounded-full bg-verde-claro flex items-center justify-center mx-auto mb-4">
              <img src="/logo.png" alt="" className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-medium text-texto mb-1">
              {t("herd.emptyTitle")}
            </h2>
            <p className="text-texto-suave text-sm mb-5">
              {t("herd.emptyHelp")}
            </p>
            <button type="button" onClick={() => open("/animais/novo")} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("herd.addFirst")}
            </button>
          </div>
        ) : total === 0 ? (
          <div className="text-center text-texto-suave mt-8">
            <p className="mb-3">{t("herd.noMatch")}</p>
            {filtersActive && (
              <button
                type="button"
                onClick={() => setParams(buildParams({ sort }, DEFAULTS), { replace: true })}
                className={buttonClass("secondary")}
              >
                {t("herd.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <div className={`bg-card border border-borda rounded-2xl overflow-hidden ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
            {/* Celular: um cartão por animal (a tabela larga não cabe) */}
            <ul className="md:hidden divide-y divide-borda">
              {pageItems.map((animal) => (
                <li key={animal.id} className="flex items-center gap-3 px-4 py-3">
                  <Link
                    to={`/animais/${animal.id}`}
                    state={originState}
                    className="flex-1 min-w-0 flex items-center gap-3"
                  >
                    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-verde-claro shrink-0">
                      <Tag size={15} className="text-verde" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-texto">{animal.tag}</span>
                      {matchedOldTag(animal, search) && (
                        <span className="block text-xs text-texto-suave">{t("herd.foundByOldTag", { tag: matchedOldTag(animal, search)! })}</span>
                      )}
                      <span className="block text-xs text-texto-suave truncate">
                        {[labelOf(animal.category, animal.sex), sexLabel[animal.sex], animal.breed]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="block text-xs text-texto-leve">
                        {animal.currentWeightKg != null
                          ? t("herd.weightKg", { value: formatNumber(animal.currentWeightKg) })
                          : t("herd.noWeighing")}
                        {animal.lot ? ` · ${animal.lot.name}` : ""}
                      </span>
                    </span>
                  </Link>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusStyle[animal.status]}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle[animal.status]}`} />
                    {statusLabel[animal.status]}
                  </span>
                  <AnimalActionsMenu
                    onEdit={() => open(`/animais/${animal.id}/editar`)}
                    onDelete={() => setDeleting(animal)}
                    onSell={
                      animal.status === "ACTIVE"
                        ? () => open(`/negociacoes/nova?tipo=venda&animal=${animal.id}`)
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>

            {/* Computador: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-texto-suave border-b border-borda">
                    <th className="font-medium px-5 py-3.5">{t("herd.colTag")}</th>
                    <th className="font-medium px-5 py-3.5">{t("herd.colAnimal")}</th>
                    <th className="font-medium px-5 py-3.5">{t("herd.colSex")}</th>
                    <th className="font-medium px-5 py-3.5">{t("herd.colBreed")}</th>
                    <th className="font-medium px-5 py-3.5">{t("herd.colWeight")}</th>
                    <th className="font-medium px-5 py-3.5">{t("herd.colStatus")}</th>
                    <th className="font-medium px-5 py-3.5 text-right">{t("herd.colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((animal) => (
                    <tr
                      key={animal.id}
                      onClick={() => open(`/animais/${animal.id}`)}
                      className="border-b border-borda last:border-0 hover:bg-bege/60 cursor-pointer"
                    >
                      {/* Brinco */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-verde-claro shrink-0">
                            <Tag size={15} className="text-verde" />
                          </span>
                          {/* Link de verdade: abre pelo teclado e em nova aba */}
                          <Link
                            to={`/animais/${animal.id}`}
                            state={originState}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-texto hover:text-verde"
                          >
                            {animal.tag}
                          </Link>
                        </div>
                        {matchedOldTag(animal, search) && (
                          <p className="text-xs text-texto-suave mt-1">{t("herd.foundByOldTag", { tag: matchedOldTag(animal, search)! })}</p>
                        )}
                      </td>

                      {/* Animal: categoria + faixa de idade */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-texto">
                          {labelOf(animal.category, animal.sex)}
                        </p>
                        <p className="text-xs text-texto-leve">
                          {formatAge(animal.birthDate, animal.birthPrecision)}
                          {animal.lot ? ` · ${animal.lot.name}` : ""}
                        </p>
                      </td>

                      {/* Sexo */}
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2 text-texto-suave">
                          {animal.sex === "MALE" ? (
                            <Mars size={15} className={sexIconStyle.MALE} />
                          ) : (
                            <Venus size={15} className={sexIconStyle.FEMALE} />
                          )}
                          {sexLabel[animal.sex]}
                        </span>
                      </td>

                      {/* Raça */}
                      <td className="px-5 py-4 text-texto-suave">
                        {animal.breed ?? "—"}
                      </td>

                      {/* Peso atual + data da última pesagem */}
                      <td className="px-5 py-4">
                        {animal.currentWeightKg != null ? (
                          <>
                            <p className="font-medium text-texto">
                              {t("herd.weightKg", { value: formatNumber(animal.currentWeightKg) })}
                            </p>
                            {animal.lastWeighingDate && (
                              <p className="text-xs text-texto-leve">
                                {t("herd.lastWeighing", { date: formatDate(animal.lastWeighingDate) })}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-texto-leve">—</p>
                            <p className="text-xs text-texto-leve">
                              {t("herd.noWeighing")}
                            </p>
                          </>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[animal.status]}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusDotStyle[animal.status]}`}
                          />
                          {statusLabel[animal.status]}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <AnimalActionsMenu
                            onEdit={() => open(`/animais/${animal.id}/editar`)}
                            onDelete={() => setDeleting(animal)}
                            onSell={
                              animal.status === "ACTIVE"
                                ? () => open(`/negociacoes/nova?tipo=venda&animal=${animal.id}`)
                                : undefined
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-borda text-sm text-texto-suave flex-wrap">
              <span>
                {t("herd.showing", {
                  from: start + 1,
                  to: Math.min(start + PAGE_SIZE, total),
                  count: total,
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label={t("herd.prevPage")}
                  className="p-1.5 rounded-lg border border-borda-chip text-texto-suave cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageWindow(currentPage, totalPages).map((p, index) =>
                  p === null ? (
                    <span key={`gap-${index}`} className="px-1 text-texto-leve" aria-hidden="true">
                      …
                    </span>
                  ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-label={t("herd.page", { page: p })}
                    aria-current={p === currentPage ? "page" : undefined}
                    className={`min-w-8 h-8 px-2 rounded-lg text-sm cursor-pointer ${
                      p === currentPage
                        ? "bg-verde text-white"
                        : "border border-borda-chip text-texto-suave"
                    }`}
                  >
                    {p}
                  </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label={t("herd.nextPage")}
                  className="p-1.5 rounded-lg border border-borda-chip text-texto-suave cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de excluir */}
        {deleting && (
          <DeleteModal
            animalId={deleting.id}
            animalTag={deleting.tag}
            onClose={() => setDeleting(null)}
            onDeleted={() => {
              setDeleting(null);
              reload();
              showToast(t("herd.deleted"));
            }}
          />
        )}
      </main>
    </div>
  );
}
