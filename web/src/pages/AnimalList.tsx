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
  categoryLabel,
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

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";
type SortValue = "tag-asc" | "tag-desc" | "createdAt-desc" | "createdAt-asc";

const PAGE_SIZE = 20;

const STATUS_TABS: [StatusFilter, string][] = [
  ["ALL", "Todos"],
  ["ACTIVE", "Ativos"],
  ["SOLD", "Vendidos"],
  ["DEAD", "Mortos"],
];

export function AnimalList() {
  const navigate = useNavigate();
  const showToast = useToast();

  // A lista completa é buscada uma vez; filtro, busca, ordenação e paginação
  // acontecem no frontend (rebanho é pequeno → instantâneo e sem recarregar).
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
          categoryLabel[a.category].toLowerCase().includes(q) ||
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
  }, [allAnimals, status, category, search, sort]);

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
            <h1 className="text-2xl font-semibold text-texto">Rebanho</h1>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-texto-suave flex-wrap">
              <span className="flex items-center gap-1.5">
                <img src="/logo.png" alt="" className="w-4 h-4 opacity-60" />
                {counts.ALL} {counts.ALL === 1 ? "animal" : "animais"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.ACTIVE}`} />
                {counts.ACTIVE} ativos
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.SOLD}`} />
                {counts.SOLD} {counts.SOLD === 1 ? "vendido" : "vendidos"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle.DEAD}`} />
                {counts.DEAD} {counts.DEAD === 1 ? "morto" : "mortos"}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate("/animais/novo")}
            className="flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer shrink-0"
          >
            <Plus size={18} /> Cadastrar animal
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
              placeholder="Buscar por brinco, categoria ou raça…"
              className="w-full bg-card border border-borda rounded-xl pl-11 pr-4 py-2.5 text-texto placeholder:text-texto-leve"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 bg-card border border-borda rounded-xl px-4 py-2.5 text-sm text-texto-suave font-medium cursor-pointer shrink-0"
          >
            <SlidersHorizontal size={16} /> Filtros
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
              {STATUS_TABS.map(([value, label]) => {
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
                Categoria
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as CategoryFilter)
                  }
                  className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
                >
                  <option value="ALL">Todas</option>
                  <option value="CALF">Bezerro</option>
                  <option value="YEARLING">Novilho</option>
                  <option value="STEER">Boi</option>
                  <option value="COW">Vaca</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-texto-suave">
                Ordenar por
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortValue)}
                  className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
                >
                  <option value="createdAt-desc">Mais recentes</option>
                  <option value="createdAt-asc">Mais antigos</option>
                  <option value="tag-asc">Brinco (A→Z)</option>
                  <option value="tag-desc">Brinco (Z→A)</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <p className="text-texto-suave">Carregando...</p>
        ) : allAnimals.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-12 text-center max-w-xl mx-auto mt-4">
            <div className="w-16 h-16 rounded-full bg-verde-claro flex items-center justify-center mx-auto mb-4">
              <img src="/logo.png" alt="" className="w-9 h-9" />
            </div>
            <h2 className="text-lg font-medium text-texto mb-1">
              Seu rebanho está vazio
            </h2>
            <p className="text-texto-suave text-sm mb-5">
              Cadastre o primeiro animal para começar a acompanhar o desempenho
              do seu rebanho.
            </p>
            <button
              onClick={() => navigate("/animais/novo")}
              className="inline-flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus size={18} /> Cadastrar primeiro animal
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-texto-suave mt-8">
            <p>Nenhum animal encontrado com esse filtro.</p>
          </div>
        ) : (
          <div className="bg-card border border-borda rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-texto-suave border-b border-borda">
                    <th className="font-medium px-5 py-3.5">Brinco</th>
                    <th className="font-medium px-5 py-3.5">Animal</th>
                    <th className="font-medium px-5 py-3.5">Sexo</th>
                    <th className="font-medium px-5 py-3.5">Raça</th>
                    <th className="font-medium px-5 py-3.5">Peso atual</th>
                    <th className="font-medium px-5 py-3.5">Status</th>
                    <th className="font-medium px-5 py-3.5 text-right">Ações</th>
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
                          {categoryLabel[animal.category]}
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
                              {formatNumber(animal.currentWeightKg)} kg
                            </p>
                            {animal.lastWeighingDate && (
                              <p className="text-xs text-texto-leve">
                                Última pesagem{" "}
                                {formatDate(animal.lastWeighingDate)}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-texto-leve">—</p>
                            <p className="text-xs text-texto-leve">
                              Sem pesagem registrada
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
                Mostrando {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}{" "}
                de {filtered.length}{" "}
                {filtered.length === 1 ? "animal" : "animais"}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-borda-chip text-texto-suave cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
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
              showToast("Animal excluído.");
            }}
          />
        )}
      </main>
    </div>
  );
}
