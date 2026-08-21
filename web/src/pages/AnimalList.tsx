import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
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

export function AnimalList() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [deleting, setDeleting] = useState<Animal | null>(null);

  function loadAnimals() {
    setLoading(true);
    listAnimals({
      status: status === "ALL" ? undefined : status,
      category: category === "ALL" ? undefined : category,
    })
      .then((data) => setAnimals(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  // Busca de novo sempre que um filtro muda.
  useEffect(() => {
    loadAnimals();
  }, [status, category]);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />

      <main className="flex-1 p-8">
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

        {/* Filtros */}
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
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-texto-suave">Carregando...</p>
        ) : animals.length === 0 ? (
          <p className="text-texto-suave">Nenhum animal encontrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {animals.map((animal) => (
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