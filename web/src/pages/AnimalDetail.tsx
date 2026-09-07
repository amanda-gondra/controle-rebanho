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
import {
  getPurchase,
  getSale,
  getAnimalResult,
  deletePurchase,
  deleteSale,
} from "../services/finance.js";
import type {
  Animal,
  Weighing,
  WeightGain,
  Application,
  Purchase,
  Sale,
  AnimalResult,
} from "../types/animal.js";
import {
  sexLabel,
  categoryLabel,
  statusLabel,
  statusStyle,
} from "../types/labels.js";
import { formatDate, formatNumber, formatMoney } from "../types/format.js";
import { WeighingModal } from "../components/WeighingModal.js";
import { EditWeighingModal } from "../components/EditWeighingModal.js";
import { StatusModal } from "../components/StatusModal.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { TradeModal } from "../components/TradeModal.js";
import { EstimatedPriceModal } from "../components/EstimatedPriceModal.js";
import { useToast } from "../components/ToastProvider.js";

export function AnimalDetail() {
  const { id } = useParams(); // pega o :id do endereço
  const navigate = useNavigate();
  const showToast = useToast();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [gain, setGain] = useState<WeightGain | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [result, setResult] = useState<AnimalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWeighingModal, setShowWeighingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingWeighing, setEditingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighing, setDeletingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighingLoading, setDeletingWeighingLoading] = useState(false);
  // Financeiro (v3.0)
  const [tradeModal, setTradeModal] = useState<{
    kind: "purchase" | "sale";
    existing: Purchase | Sale | null;
  } | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState<"purchase" | "sale" | null>(
    null,
  );
  const [deletingTradeLoading, setDeletingTradeLoading] = useState(false);

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
    // 404 é esperado quando não há compra/venda registrada — vira null.
    getPurchase(id)
      .then((data) => setPurchase(data))
      .catch(() => setPurchase(null));
    getSale(id)
      .then((data) => setSale(data))
      .catch(() => setSale(null));
    getAnimalResult(id)
      .then((data) => setResult(data))
      .catch(() => setResult(null));
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

  // Confirma a exclusão de uma compra, ou o desfazer de uma venda.
  async function handleDeleteTrade() {
    if (!id || !deletingTrade) return;
    setDeletingTradeLoading(true);
    try {
      if (deletingTrade === "purchase") {
        await deletePurchase(id);
        showToast("Compra removida.");
      } else {
        await deleteSale(id);
        showToast("Venda desfeita. O animal voltou a ativo.");
      }
      setDeletingTrade(null);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingTradeLoading(false);
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

        {/* Financeiro (v3.0) — compra, venda e resultado do animal */}
        <div className="bg-card border border-borda rounded-xl p-6 mt-6">
          <p className="font-medium text-texto mb-4">Financeiro</p>

          {/* Resultado apurado (real se vendido, estimado se vivo) */}
          {result && result.resultType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-bege p-4">
                <p className="text-sm text-texto-suave mb-1">Custo de compra</p>
                <p className="text-xl font-medium text-texto">
                  {result.purchaseCost !== null
                    ? formatMoney(result.purchaseCost)
                    : "Não informado"}
                </p>
              </div>
              <div className="rounded-xl bg-bege p-4">
                <p className="text-sm text-texto-suave mb-1">
                  {result.resultType === "REALIZED"
                    ? "Receita da venda"
                    : "Valor estimado"}
                </p>
                <p className="text-xl font-medium text-texto">
                  {formatMoney(
                    result.resultType === "REALIZED"
                      ? (result.saleRevenue ?? 0)
                      : (result.estimatedValue ?? 0),
                  )}
                </p>
              </div>
              <div className="rounded-xl bg-bege p-4">
                <p className="text-sm text-texto-suave mb-1">
                  Resultado
                  {result.resultType === "ESTIMATED" ? " (estimado)" : ""}
                </p>
                <p
                  className={`text-xl font-medium ${
                    (result.result ?? 0) >= 0 ? "text-verde" : "text-alerta"
                  }`}
                >
                  {formatMoney(result.result ?? 0)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-texto-suave text-sm mb-6">
              Registre a compra e informe o preço estimado (com ao menos uma
              pesagem) para ver o resultado enquanto o animal não é vendido.
            </p>
          )}

          {/* Linhas: compra, venda e — se ainda vivo — preço estimado */}
          <div className="flex flex-col divide-y divide-borda">
            {/* Compra */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-texto">Compra</p>
                <p className="text-xs text-texto-suave">
                  {purchase
                    ? `${formatDate(purchase.date)} · ${formatNumber(
                        Number(purchase.weightKg),
                      )} kg × ${formatMoney(Number(purchase.pricePerKg))}/kg`
                    : "Não registrada"}
                </p>
              </div>
              {purchase ? (
                <div className="flex items-center gap-3">
                  <span className="font-medium text-texto">
                    {formatMoney(
                      Number(purchase.weightKg) * Number(purchase.pricePerKg),
                    )}
                  </span>
                  <button
                    onClick={() =>
                      setTradeModal({ kind: "purchase", existing: purchase })
                    }
                    title="Editar compra"
                    className="text-texto-leve hover:text-verde cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeletingTrade("purchase")}
                    title="Remover compra"
                    className="text-texto-leve hover:text-alerta cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() =>
                    setTradeModal({ kind: "purchase", existing: null })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
                >
                  <Plus size={15} /> Registrar
                </button>
              )}
            </div>

            {/* Venda */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-texto">Venda</p>
                <p className="text-xs text-texto-suave">
                  {sale
                    ? `${formatDate(sale.date)} · ${formatNumber(
                        Number(sale.weightKg),
                      )} kg × ${formatMoney(Number(sale.pricePerKg))}/kg`
                    : animal.status === "DEAD"
                      ? "Animal morto"
                      : "Não registrada"}
                </p>
              </div>
              {sale ? (
                <div className="flex items-center gap-3">
                  <span className="font-medium text-texto">
                    {formatMoney(
                      Number(sale.weightKg) * Number(sale.pricePerKg),
                    )}
                  </span>
                  <button
                    onClick={() =>
                      setTradeModal({ kind: "sale", existing: sale })
                    }
                    title="Editar venda"
                    className="text-texto-leve hover:text-verde cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeletingTrade("sale")}
                    title="Desfazer venda"
                    className="text-texto-leve hover:text-alerta cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTradeModal({ kind: "sale", existing: null })}
                  disabled={animal.status === "DEAD"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={15} /> Registrar
                </button>
              )}
            </div>

            {/* Preço estimado — só faz sentido enquanto o animal está vivo e não vendido */}
            {!sale && animal.status !== "DEAD" && (
              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-texto">
                    Preço estimado (kg)
                  </p>
                  <p className="text-xs text-texto-suave">
                    {animal.estimatedPricePerKg
                      ? `${formatMoney(Number(animal.estimatedPricePerKg))}/kg`
                      : "Não informado"}
                  </p>
                </div>
                <button
                  onClick={() => setShowPriceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
                >
                  {animal.estimatedPricePerKg ? (
                    <>
                      <Pencil size={15} /> Alterar
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> Informar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
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

        {/* Modal de compra / venda (cadastro e edição) */}
        {tradeModal && (
          <TradeModal
            animalId={animal.id}
            animalTag={animal.tag}
            kind={tradeModal.kind}
            existing={tradeModal.existing}
            onClose={() => setTradeModal(null)}
            onSaved={() => {
              const wasEdit = !!tradeModal.existing;
              const noun = tradeModal.kind === "sale" ? "Venda" : "Compra";
              setTradeModal(null);
              loadData();
              showToast(`${noun} ${wasEdit ? "atualizada" : "registrada"}.`);
            }}
          />
        )}

        {/* Modal do preço estimado */}
        {showPriceModal && (
          <EstimatedPriceModal
            animalId={animal.id}
            animalTag={animal.tag}
            current={animal.estimatedPricePerKg}
            onClose={() => setShowPriceModal(false)}
            onSaved={() => {
              setShowPriceModal(false);
              loadData();
              showToast("Preço estimado atualizado.");
            }}
          />
        )}

        {/* Confirmação de remover compra / desfazer venda */}
        {deletingTrade && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setDeletingTrade(null)}
          >
            <div
              className="bg-card rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-medium text-texto mb-1">
                {deletingTrade === "purchase"
                  ? "Remover compra?"
                  : "Desfazer venda?"}
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                {deletingTrade === "purchase"
                  ? "O custo de compra deixa de entrar no resultado deste animal."
                  : "A venda é apagada e o animal volta para o status Ativo."}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingTrade(null)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteTrade}
                  disabled={deletingTradeLoading}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deletingTradeLoading
                    ? "Processando..."
                    : deletingTrade === "purchase"
                      ? "Remover"
                      : "Desfazer"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}