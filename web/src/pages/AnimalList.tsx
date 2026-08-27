import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { listAnimals } from "../services/animals.js";
import type { Animal, Status, Category } from "../types/animal.js";
import {
  sexLabel,
  categoryLabel,
  statusLabel,
  statusStyle,
} from "../types/labels.js";
import { Sidebar } from "../components/Sidebar.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { useToast } from "../components/ToastProvider.js";

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";
type SortValue = "tag-asc" | "tag-desc" | "createdAt-desc" | "createdAt-asc";

export function AnimalList() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [sort, setSort] = useState<SortValue>("tag-asc");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<Animal | null>(null);

  function loadAnimals() {
    setLoading(true);
    // desmembra o valor do seletor (ex.: "tag-asc") em sortBy + order
    const [sortBy, order] = sort.split("-") as [
      "tag" | "createdAt",
      "asc" | "desc",
    ];
    listAnimals({
      status: status === "ALL" ? undefined : status,
      category: category === "ALL" ? undefined : category,
      sortBy,
      order,
    })
      .then((data) => setAnimals(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  // Busca de novo sempre que um filtro ou a ordenação muda.
  useEffect(() => {
    loadAnimals();
  }, [status, category, sort]);

  // Busca por brinco: filtra no frontend (instantâneo) a lista já carregada.
  const visibleAnimals = animals.filter((animal) =>
    animal.tag.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />

      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-texto">Rebanho</h1>
            <p className="text-texto-suave">
              {animals.length}{" "}
              {animals.length === 1
                ? "animal cadastrado"
                : "animais cadastrados"}
            </p>
          </div>
          <button
            onClick={() => navigate("/animais/novo")}
            className="flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
          >
            <Plus size={18} /> Cadastrar animal
          </button>
        </div>

        {/* Busca por brinco */}
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por brinco (ex.: BR-004)"
            className="w-full bg-card border border-borda rounded-lg pl-10 pr-3 py-2.5 text-texto"
          />
        </div>

        {/* Filtros + ordenação */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-2">
            {(
              [
                ["ALL", "Todos"],
                ["ACTIVE", "Ativos"],
                ["SOLD", "Vendidos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatus(value)}
                className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
                  status === value
                    ? "bg-verde border-verde text-white"
                    : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-texto-suave">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryFilter)}
                className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="ALL">Todas</option>
                <option value="CALF">Bezerro</option>
                <option value="YEARLING">Novilho</option>
                <option value="STEER">Boi</option>
                <option value="COW">Vaca</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-texto-suave">Ordenar</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                className="bg-card border border-borda rounded-lg px-3 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="tag-asc">Brinco (crescente)</option>
                <option value="tag-desc">Brinco (decrescente)</option>
                <option value="createdAt-desc">Mais recentes</option>
                <option value="createdAt-asc">Mais antigos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-texto-suave">Carregando...</p>
        ) : animals.length === 0 ? (
          status === "ALL" && category === "ALL" ? (
            // Rebanho realmente vazio (sem nenhum filtro ativo)
            <div className="bg-card border border-borda rounded-xl p-12 text-center max-w-xl mx-auto mt-4">
              <div className="w-16 h-16 rounded-full bg-verde-claro flex items-center justify-center mx-auto mb-4">
                <img src="/logo.png" alt="" className="w-9 h-9" />
              </div>
              <h2 className="text-lg font-medium text-texto mb-1">
                Seu rebanho está vazio
              </h2>
              <p className="text-texto-suave text-sm mb-5">
                Cadastre o primeiro animal para começar a acompanhar o
                desempenho do seu rebanho.
              </p>
              <button
                onClick={() => navigate("/animais/novo")}
                className="inline-flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <Plus size={18} /> Cadastrar primeiro animal
              </button>
            </div>
          ) : (
            // Tem animais, mas o filtro não achou nenhum
            <div className="text-center text-texto-suave mt-8">
              <p>Nenhum animal encontrado com esse filtro.</p>
            </div>
          )
        ) : visibleAnimals.length === 0 ? (
          // A lista tem animais, mas a busca por brinco não achou
          <div className="text-center text-texto-suave mt-8">
            <p>Nenhum animal com esse brinco.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleAnimals.map((animal) => (
              <div
                key={animal.id}
                onClick={() => navigate(`/animais/${animal.id}`)}
                className="bg-card border border-borda rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:border-verde-nevoa"
              >
                <div className="flex items-center gap-6">
                  <span className="font-medium text-texto w-20">
                    {animal.tag}
                  </span>
                  <span className="text-sm text-texto-suave">
                    {categoryLabel[animal.category]} · {sexLabel[animal.sex]} ·{" "}
                    {animal.breed ?? "—"}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-medium text-texto">
                    {animal.currentWeightKg != null
                      ? `${String(animal.currentWeightKg).replace(".", ",")} kg`
                      : "—"}
                  </span>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[animal.status]}`}
                  >
                    {statusLabel[animal.status]}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/animais/${animal.id}/editar`);
                    }}
                    title="Editar animal"
                    className="text-texto-leve hover:text-verde cursor-pointer"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(animal);
                    }}
                    title="Excluir animal"
                    className="text-texto-leve hover:text-alerta cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
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
              loadAnimals(); // recarrega a lista sem o animal excluído
              showToast("Animal excluído.");
            }}
          />
        )}
      </main>
    </div>
  );
}