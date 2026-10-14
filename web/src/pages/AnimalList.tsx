import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { listAnimals } from "../services/animals.js";
import type { Animal, Status, Category } from "../types/animal.js";
import {
  sexLabel,
  statusLabel,
  statusStyle,
  statusDotStyle,
  sexIconStyle,
} from "../types/labels.js";
import { formatAge, formatDate, formatNumber } from "../types/format.js";
import { Sidebar } from "../components/Sidebar.js";
import { AnimalActionsMenu } from "../components/AnimalActionsMenu.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { useToast } from "../components/ToastProvider.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { CATEGORY_FILTER_ORDER } from "../types/categories.js";
import { t } from "../i18n/index.js";

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";
type SortValue = "tag-asc" | "tag-desc" | "createdAt-desc" | "createdAt-asc";

const PAGE_SIZE = 20;

const STATUS_TABS: StatusFilter[] = ["ALL", "ACTIVE", "SOLD", "DEAD"];

export function AnimalList() {
  const navigate = useNavigate();
  const showToast = useToast();

  // A lista completa é buscada uma vez; filtro, busca, ordenação e paginação
  // acontecem no frontend (rebanho é pequeno → instantâneo e sem recarregar).
  const { labelOf, filterLabelOf } = useCategoryLabels();
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [sort, setSort] = useState<SortValue>("createdAt-desc");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Animal | null>(null);

  function loadAnimals() {
    setLoading(true);
    listAnimals()
      .then((data) => setAllAnimals(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAnimals();
  }, []);

  // Volta pra primeira página sempre que o recorte muda.
  useEffect(() => {
    setPage(1);
  }, [status, category, sort, search]);

  // Contadores do topo e das abas — sempre sobre a lista inteira.
  const counts = useMemo(
    () => ({
      ALL: allAnimals.length,
      ACTIVE: allAnimals.filter((a) => a.status === "ACTIVE").length,
      SOLD: allAnimals.filter((a) => a.status === "SOLD").length,
      DEAD: allAnimals.filter((a) => a.status === "DEAD").length,
    }),
    [allAnimals],
  );

  // Recorte visível: filtros + busca + ordenação.
  const filtered = useMemo(() => {
    let list = allAnimals;

    if (status !== "ALL") list = list.filter((a) => a.status === status);
    if (category !== "ALL") list = list.filter((a) => a.category === category);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.tag.toLowerCase().includes(q) ||
          labelOf(a.category, a.sex).toLowerCase().includes(q) ||
          (a.breed ?? "").toLowerCase().includes(q),
      );
    }

    const [sortBy, order] = sort.split("-") as ["tag" | "createdAt", "asc" | "desc"];
    list = [...list].sort((a, b) => {
      const av = sortBy === "tag" ? a.tag : a.createdAt;
      const bv = sortBy === "tag" ? b.tag : b.createdAt;
      return order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return list;
  }, [allAnimals, status, category, search, sort, labelOf]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-texto">{t("herd.title")}</h1>
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
          </div>

          <button
            onClick={() => navigate("/animais/novo")}
            className="flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer shrink-0"
          >
            <Plus size={18} /> {t("herd.addAnimal")}
          </button>
        </div>

        {/* Busca + botão Filtros */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-leve"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("herd.searchPlaceholder")}
              aria-label={t("herd.searchPlaceholder")}
              className="w-full bg-card border border-borda rounded-xl pl-11 pr-4 py-2.5 text-texto placeholder:text-texto-leve"
            />
          </div>
          <button
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
                    onClick={() => setStatus(value)}
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
                  onChange={(e) =>
                    setCategory(e.target.value as CategoryFilter)
                  }
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

              <label className="flex items-center gap-2 text-sm text-texto-suave">
                {t("herd.sortBy")}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortValue)}
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
        {loading ? (
          <p className="text-texto-suave">{t("common.loading")}</p>
        ) : allAnimals.length === 0 ? (
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
            <button
              onClick={() => navigate("/animais/novo")}
              className="inline-flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus size={18} /> {t("herd.addFirst")}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-texto-suave mt-8">
            <p>{t("herd.noMatch")}</p>
          </div>
        ) : (
          <div className="bg-card border border-borda rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
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
                      onClick={() => navigate(`/animais/${animal.id}`)}
                      className="border-b border-borda last:border-0 hover:bg-bege/60 cursor-pointer"
                    >
                      {/* Brinco */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-verde-claro shrink-0">
                            <Tag size={15} className="text-verde" />
                          </span>
                          <span className="font-medium text-texto">
                            {animal.tag}
                          </span>
                        </div>
                      </td>

                      {/* Animal: categoria + faixa de idade */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-texto">
                          {labelOf(animal.category, animal.sex)}
                        </p>
                        <p className="text-xs text-texto-leve">
                          {formatAge(animal.birthDate, animal.birthPrecision)}
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
                            onEdit={() =>
                              navigate(`/animais/${animal.id}/editar`)
                            }
                            onDelete={() => setDeleting(animal)}
                            onSell={
                              animal.status === "ACTIVE"
                                ? () => navigate(`/negociacoes/nova?tipo=venda&animal=${animal.id}`)
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
                  to: Math.min(start + PAGE_SIZE, filtered.length),
                  count: filtered.length,
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label={t("herd.prevPage")}
                  className="p-1.5 rounded-lg border border-borda-chip text-texto-suave cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-label={t("herd.page", { page: p })}
                    className={`min-w-8 h-8 px-2 rounded-lg text-sm cursor-pointer ${
                      p === currentPage
                        ? "bg-verde text-white"
                        : "border border-borda-chip text-texto-suave"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => p + 1)}
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
              loadAnimals();
              showToast(t("herd.deleted"));
            }}
          />
        )}
      </main>
    </div>
  );
}
