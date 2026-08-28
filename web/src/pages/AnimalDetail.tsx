import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, RefreshCw, Trash2, Syringe, Pill } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Sidebar } from "../components/Sidebar.js";
import {
  getAnimal,
  listWeighings,
  getWeightGain,
  deleteWeighing,
} from "../services/animals.js";
import { listAnimalApplications } from "../services/sanitary.js";
import type { Animal, Weighing, WeightGain, Application } from "../types/animal.js";
import {
  sexLabel,
  categoryLabel,
  statusLabel,
  statusStyle,
} from "../types/labels.js";
import { formatDate, formatNumber } from "../types/format.js";
import { WeighingModal } from "../components/WeighingModal.js";
import { EditWeighingModal } from "../components/EditWeighingModal.js";
import { StatusModal } from "../components/StatusModal.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { useToast } from "../components/ToastProvider.js";

export function AnimalDetail() {
  const { id } = useParams(); // pega o :id do endereço
  const navigate = useNavigate();
  const showToast = useToast();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [gain, setGain] = useState<WeightGain | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWeighingModal, setShowWeighingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingWeighing, setEditingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighing, setDeletingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighingLoading, setDeletingWeighingLoading] = useState(false);

  // Busca (ou rebusca) todos os dados do animal.
  function loadData() {
    if (!id) return;
    getAnimal(id)
      .then((data) => setAnimal(data))
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else console.error(err);
      })
      .finally(() => setLoading(false));
    listWeighings(id)
      .then((data) => setWeighings(data))
      .catch((err) => console.error(err));
    getWeightGain(id)
      .then((data) => setGain(data))
      .catch(() => setGain(null)); // sem 2 pesagens: fica null
    listAnimalApplications(id)
      .then((data) => setApplications(data))
      .catch((err) => console.error(err));
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [id]);

  // Confirma a exclusão de uma pesagem
  async function handleDeleteWeighing() {
    if (!id || !deletingWeighing) return;
    setDeletingWeighingLoading(true);
    try {
      await deleteWeighing(id, deletingWeighing.id);
      setDeletingWeighing(null);
      loadData();
      showToast("Pesagem excluída.");
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingWeighingLoading(false);
    }
  }

  // Enquanto carrega
  if (loading) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <p className="text-texto-suave">Carregando...</p>
        </main>
      </div>
    );
  }

  // Animal não encontrado (404) — mensagem amigável
  if (notFound || !animal) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-medium text-texto mb-2">
              Não encontramos este animal
            </h2>
            <p className="text-texto-suave mb-4">
              Ele pode ter sido removido, ou o código do brinco está diferente.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer"
            >
              Voltar para o rebanho
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Monta o texto da data de nascimento conforme a precisão
  let birthText = "Idade não informada";
  if (animal.birthDate && animal.birthPrecision === "DAY_MONTH_YEAR") {
    birthText = `Nascido em ${formatDate(animal.birthDate)}`;
  } else if (animal.birthDate && animal.birthPrecision === "MONTH_YEAR") {
    const d = new Date(animal.birthDate);
    birthText = `Nascido em ${d.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })}`;
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            title="Voltar para o rebanho"
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-medium text-texto">{animal.tag}</h1>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[animal.status]}`}
              >
                {statusLabel[animal.status]}
              </span>
            </div>
            <p className="text-texto-suave">
              {categoryLabel[animal.category]} · {sexLabel[animal.sex]} ·{" "}
              {animal.breed ?? "—"}
            </p>
            <p className="text-sm text-texto-leve">{birthText}</p>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/animais/${animal.id}/editar`)}
              title="Editar animal"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              title="Mudar o status do animal"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <RefreshCw size={16} /> Mudar status
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              title="Excluir animal"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-alerta text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        </div>

        {/* Resumo + gráfico (se tem 2+ pesagens) ou estado vazio */}
        {gain ? (
          <>
            {/* Cartões de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">Peso atual</p>
                <p className="text-2xl font-medium text-texto">
                  {formatNumber(gain.lastWeightKg)} kg
                </p>
              </div>
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">
                  Ganho médio diário (GMD)
                </p>
                <p className="text-2xl font-medium text-texto">
                  {formatNumber(gain.averageDailyGainKg)} kg/dia
                </p>
              </div>
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">Ganho total</p>
                <p className="text-2xl font-medium text-texto">
                  {formatNumber(gain.totalGainKg)} kg
                </p>
              </div>
            </div>

            {/* Gráfico da evolução do peso */}
            <div className="bg-card border border-borda rounded-xl p-6 mb-6">
              <p className="font-medium text-texto mb-4">Evolução do peso</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={[...weighings].reverse().map((w) => ({
                    data: formatDate(w.date),
                    peso: Number(w.weightKg),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D2" />
                  <XAxis dataKey="data" stroke="#6B6459" fontSize={12} />
                  <YAxis stroke="#6B6459" fontSize={12} unit=" kg" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#3B6D11"
                    strokeWidth={2}
                    dot={{ fill: "#3B6D11" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="bg-card border border-borda rounded-xl p-10 mb-6 text-center">
            <p className="text-texto font-medium mb-1">
              Ainda não dá para calcular o ganho de peso
            </p>
            <p className="text-texto-suave text-sm mb-4">
              Registre pelo menos duas pesagens e o gráfico aparece aqui.
            </p>
            <button
              onClick={() => setShowWeighingModal(true)}
              className="inline-flex items-center gap-2 bg-verde text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer"
            >
              <Plus size={16} /> Registrar pesagem
            </button>
          </div>
        )}

        {/* Histórico de pesagens */}
        <div className="bg-card border border-borda rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium text-texto">Pesagens</p>
            <button
              onClick={() => setShowWeighingModal(true)}
              className="flex items-center gap-2 bg-verde text-white text-sm font-medium px-3 py-2 rounded-lg cursor-pointer"
            >
              <Plus size={16} /> Registrar pesagem
            </button>
          </div>

          {weighings.length === 0 ? (
            <p className="text-texto-suave text-sm">
              Nenhuma pesagem registrada ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-borda">
              {weighings.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-texto-suave text-sm">
                    {formatDate(w.date)}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-texto">
                      {String(w.weightKg).replace(".", ",")} kg
                    </span>
                    <button
                      onClick={() => setEditingWeighing(w)}
                      title="Editar pesagem"
                      className="text-texto-leve hover:text-verde cursor-pointer"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeletingWeighing(w)}
                      title="Excluir pesagem"
                      className="text-texto-leve hover:text-alerta cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manejo sanitário (vacinas e vermífugos deste animal) */}
        <div className="bg-card border border-borda rounded-xl p-6">
          <p className="font-medium text-texto mb-4">Manejo sanitário</p>
          {applications.length === 0 ? (
            <p className="text-texto-suave text-sm">
              Nenhuma vacina ou vermífugo registrado para este animal.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-borda">
              {applications.map((app) => {
                const isVaccine = app.product.type === "VACCINE";
                return (
                  <div
                    key={app.id}
                    onClick={() => navigate(`/aplicacoes/${app.id}`)}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-bege -mx-2 px-2 rounded-lg"
                  >
                    <span
                      className={`flex items-center justify-center w-9 h-9 rounded-full ${
                        isVaccine
                          ? "bg-verde-claro text-verde"
                          : "bg-bege text-couro"
                      }`}
                    >
                      {isVaccine ? <Syringe size={16} /> : <Pill size={16} />}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-texto text-sm">
                        {app.product.name}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {isVaccine ? "Vacina" : "Vermífugo"} ·{" "}
                        {formatDate(app.date)}
                        {app.notes ? ` · ${app.notes}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de registrar pesagem */}
        {showWeighingModal && (
          <WeighingModal
            animalId={animal.id}
            animalTag={animal.tag}
            onClose={() => setShowWeighingModal(false)}
            onSaved={() => {
              setShowWeighingModal(false);
              loadData();
              showToast("Pesagem registrada.");
            }}
          />
        )}

        {/* Modal de editar pesagem */}
        {editingWeighing && (
          <EditWeighingModal
            animalId={animal.id}
            weighing={editingWeighing}
            onClose={() => setEditingWeighing(null)}
            onSaved={() => {
              setEditingWeighing(null);
              loadData();
              showToast("Pesagem atualizada.");
            }}
          />
        )}

        {/* Confirmação de excluir pesagem */}
        {deletingWeighing && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setDeletingWeighing(null)}
          >
            <div
              className="bg-card rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-medium text-texto mb-1">
                Excluir pesagem?
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                Tem certeza que quer excluir a pesagem de{" "}
                {formatDate(deletingWeighing.date)} (
                {String(deletingWeighing.weightKg).replace(".", ",")} kg)? Isso
                pode alterar o cálculo do ganho de peso.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingWeighing(null)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteWeighing}
                  disabled={deletingWeighingLoading}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deletingWeighingLoading ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de mudar status */}
        {showStatusModal && (
          <StatusModal
            animalId={animal.id}
            animalTag={animal.tag}
            currentStatus={animal.status}
            onClose={() => setShowStatusModal(false)}
            onSaved={() => {
              setShowStatusModal(false);
              loadData();
              showToast("Status atualizado.");
            }}
          />
        )}

        {/* Modal de excluir */}
        {showDeleteModal && (
          <DeleteModal
            animalId={animal.id}
            animalTag={animal.tag}
            onClose={() => setShowDeleteModal(false)}
            onDeleted={() => {
              showToast("Animal excluído.");
              navigate("/");
            }}
          />
        )}
      </main>
    </div>
  );
}