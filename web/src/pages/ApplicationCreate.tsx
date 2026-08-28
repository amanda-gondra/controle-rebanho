import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Check } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listAnimals } from "../services/animals.js";
import { listProducts, createApplication } from "../services/sanitary.js";
import type {
  Animal,
  Product,
  ProductType,
  Status,
  Category,
} from "../types/animal.js";
import { categoryLabel, sexLabel } from "../types/labels.js";
import { useToast } from "../components/ToastProvider.js";

type StatusFilter = Status | "ALL";
type CategoryFilter = Category | "ALL";

export function ApplicationCreate() {
  const navigate = useNavigate();
  const showToast = useToast();

  // dados da aplicação
  const [type, setType] = useState<ProductType>("VACCINE");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  // seletor de animais
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // carrega os produtos do tipo escolhido (vacina ou vermífugo)
  useEffect(() => {
    listProducts(type)
      .then((data) => {
        setProducts(data);
        setProductId(""); // limpa a escolha ao trocar de tipo
      })
      .catch((err) => console.error(err));
  }, [type]);

  // carrega os animais conforme os filtros
  useEffect(() => {
    listAnimals({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      category: categoryFilter === "ALL" ? undefined : categoryFilter,
      sortBy: "tag",
      order: "asc",
    })
      .then((data) => setAnimals(data))
      .catch((err) => console.error(err));
  }, [statusFilter, categoryFilter]);

  // aplica a busca por brinco (no frontend, instantâneo)
  const visibleAnimals = animals.filter((a) =>
    a.tag.toLowerCase().includes(search.trim().toLowerCase()),
  );

  // marca/desmarca um animal
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // seleciona (ou limpa) todos os visíveis
  function toggleAllVisible() {
    const visibleIds = visibleAnimals.map((a) => a.id);
    const allSelected = visibleIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id)); // desmarca todos
      } else {
        visibleIds.forEach((id) => next.add(id)); // marca todos
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!productId) return setError("Escolha o produto.");
    if (!date) return setError("Informe a data da aplicação.");
    if (selected.size === 0)
      return setError("Selecione pelo menos um animal.");

    setSaving(true);
    try {
      await createApplication({
        productId,
        date,
        notes: notes.trim() || undefined,
        animalIds: Array.from(selected),
      });
      showToast("Aplicação registrada.");
      navigate("/manejo");
    } catch (err: any) {
      setError(err?.message ?? "Algo deu errado. Tente de novo.");
      setSaving(false);
    }
  }

  const allVisibleSelected =
    visibleAnimals.length > 0 &&
    visibleAnimals.every((a) => selected.has(a.id));

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate("/manejo")}
            title="Voltar"
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-medium text-texto">
              Registrar aplicação
            </h1>
            <p className="text-texto-suave">
              Vacina ou vermífugo, em um ou vários animais
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Dados da aplicação */}
          <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-6">
            {/* Tipo */}
            <div className="mb-4">
              <label className="block font-medium text-texto mb-1">Tipo</label>
              <div className="flex gap-3">
                {(
                  [
                    ["VACCINE", "Vacina"],
                    ["DEWORMER", "Vermífugo"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                      type === value
                        ? "bg-verde border-verde text-white"
                        : "bg-card border-borda-chip text-texto-suave"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Produto */}
            <div className="mb-4">
              <label className="block font-medium text-texto mb-1">
                Produto <span className="text-alerta">*</span>
              </label>
              {products.length === 0 ? (
                <p className="text-sm text-texto-suave">
                  Nenhum produto cadastrado.{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/produtos")}
                    className="text-verde underline cursor-pointer"
                  >
                    Cadastrar agora
                  </button>
                </p>
              ) : (
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
                >
                  <option value="">Escolha o produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Data */}
            <div className="mb-4">
              <label className="block font-medium text-texto mb-1">
                Data <span className="text-alerta">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>

            {/* Observação */}
            <div>
              <label className="block font-medium text-texto mb-1">
                Observação{" "}
                <span className="text-texto-leve font-normal">(opcional)</span>
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: 1ª dose"
                className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>
          </div>

          {/* Seletor de animais */}
          <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-texto">
                Em quais animais?{" "}
                <span className="text-verde">{selected.size} selecionados</span>
              </p>
              <button
                type="button"
                onClick={toggleAllVisible}
                className="text-sm text-verde font-medium cursor-pointer"
              >
                {allVisibleSelected ? "Limpar seleção" : "Selecionar todos"}
              </button>
            </div>

            {/* Busca */}
            <div className="relative mb-3">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por brinco"
                className="w-full bg-bege border border-borda rounded-lg pl-9 pr-3 py-2 text-sm text-texto"
              />
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="ACTIVE">Ativos</option>
                <option value="ALL">Todos os status</option>
                <option value="SOLD">Vendidos</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as CategoryFilter)
                }
                className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="ALL">Todas as categorias</option>
                <option value="CALF">Bezerro</option>
                <option value="YEARLING">Novilho</option>
                <option value="STEER">Boi</option>
                <option value="COW">Vaca</option>
              </select>
            </div>

            {/* Lista de animais com checkbox */}
            {visibleAnimals.length === 0 ? (
              <p className="text-sm text-texto-suave">
                Nenhum animal encontrado.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {visibleAnimals.map((a) => {
                  const isSelected = selected.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left cursor-pointer ${
                        isSelected
                          ? "bg-verde-claro border-verde"
                          : "bg-card border-borda-chip"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded border ${
                          isSelected
                            ? "bg-verde border-verde text-white"
                            : "border-borda-chip"
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                      </span>
                      <span className="font-medium text-texto w-16">
                        {a.tag}
                      </span>
                      <span className="text-sm text-texto-suave">
                        {categoryLabel[a.category]} · {sexLabel[a.sex]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-alerta mb-4 max-w-2xl">{error}</p>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 max-w-2xl">
            <button
              type="button"
              onClick={() => navigate("/manejo")}
              className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? "Registrando..." : "Registrar aplicação"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}