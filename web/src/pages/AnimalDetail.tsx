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
  statusLabel,
  statusStyle,
} from "../types/labels.js";
import { formatDate, formatMonthYear, formatNumber, formatMoney } from "../types/format.js";
import { WeighingModal } from "../components/WeighingModal.js";
import { EditWeighingModal } from "../components/EditWeighingModal.js";
import { StatusModal } from "../components/StatusModal.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { TradeModal } from "../components/TradeModal.js";
import { EstimatedPriceModal } from "../components/EstimatedPriceModal.js";
import { useToast } from "../components/ToastProvider.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";

export function AnimalDetail() {
  const { id } = useParams(); // pega o :id do endereço
  const navigate = useNavigate();
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [gain, setGain] = useState<WeightGain | null>(null);
  // Por que o ganho não foi calculado (código vindo da API)
  const [gainUnavailableCode, setGainUnavailableCode] = useState<string | null>(null);
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
      .then((data) => {
        setGain(data);
        setGainUnavailableCode(null);
      })
      .catch((err) => {
        setGain(null); // sem cálculo possível: fica null
        setGainUnavailableCode(err?.code ?? null);
      });
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
      showToast(t("animalDetail.weighingDeleted"));
    } catch (err) {
      showToast(errorMessage(err, "animalDetail.weighingDeleteFailed"));
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
        showToast(t("animalDetail.purchaseRemoved"));
      } else {
        await deleteSale(id);
        showToast(t("animalDetail.saleUndone"));
      }
      setDeletingTrade(null);
      loadData();
    } catch (err) {
      showToast(errorMessage(err, "animalDetail.tradeFailed"));
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
          <p className="text-texto-suave">{t("common.loading")}</p>
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
              {t("animalDetail.notFoundTitle")}
            </h2>
            <p className="text-texto-suave mb-4">
              {t("animalDetail.notFoundHelp")}
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer"
            >
              {t("animalDetail.backToHerd")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Monta o texto da data de nascimento conforme a precisão
  let birthText = t("animalDetail.birthUnknown");
  if (animal.birthDate && animal.birthPrecision === "DAY_MONTH_YEAR") {
    birthText = t("animalDetail.bornOn", { date: formatDate(animal.birthDate) });
  } else if (animal.birthDate && animal.birthPrecision === "MONTH_YEAR") {
    birthText = t("animalDetail.bornOn", { date: formatMonthYear(animal.birthDate) });
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            title={t("animalDetail.backToHerd")}
            aria-label={t("animalDetail.backToHerd")}
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
              {t("animalDetail.summary", {
                category: labelOf(animal.category, animal.sex),
                sex: animal.castrated
                  ? `${sexLabel[animal.sex]} ${t("animalDetail.castratedSuffix")}`
                  : sexLabel[animal.sex],
                breed: animal.breed ?? t("animalDetail.noBreed"),
              })}
            </p>
            <p className="text-sm text-texto-leve">{birthText}</p>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => navigate(`/animais/${animal.id}/editar`)}
              title={t("animalDetail.editLabel")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Pencil size={16} /> {t("common.edit")}
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              title={t("animalDetail.statusLabel")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <RefreshCw size={16} /> {t("animalDetail.changeStatus")}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              title={t("animalDetail.deleteLabel")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-alerta text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Trash2 size={16} /> {t("common.delete")}
            </button>
          </div>
        </div>

        {/* Resumo + gráfico (se tem 2+ pesagens) ou estado vazio */}
        {gain ? (
          <>
            {/* Cartões de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">{t("animalDetail.currentWeight")}</p>
                <p className="text-2xl font-medium text-texto">
                  {t("units.kgValue", { value: formatNumber(gain.lastWeightKg) })}
                </p>
              </div>
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">{t("animalDetail.adg")}</p>
                <p className="text-2xl font-medium text-texto">
                  {t("units.kgPerDay", { value: formatNumber(gain.averageDailyGainKg) })}
                </p>
              </div>
              <div className="bg-card border border-borda rounded-xl p-5">
                <p className="text-sm text-texto-suave mb-1">{t("animalDetail.totalGain")}</p>
                <p className="text-2xl font-medium text-texto">
                  {t("units.kgValue", { value: formatNumber(gain.totalGainKg) })}
                </p>
              </div>
            </div>

            {/* Gráfico da evolução do peso */}
            <div className="bg-card border border-borda rounded-xl p-6 mb-6">
              <p className="font-medium text-texto mb-4">{t("animalDetail.weightChart")}</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={[...weighings].reverse().map((w) => ({
                    date: formatDate(w.date),
                    weight: Number(w.weightKg),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D2" />
                  <XAxis dataKey="date" stroke="#6B6459" fontSize={12} />
                  <YAxis stroke="#6B6459" fontSize={12} unit={t("units.kgSuffix")} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name={t("animalDetail.weightSeries")}
                    unit={t("units.kgSuffix")}
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
              {t("animalDetail.noGainTitle")}
            </p>
            <p className="text-texto-suave text-sm mb-4">
              {gainUnavailableCode === "SAME_DAY_WEIGHINGS"
                ? t("animalDetail.noGainSameDay")
                : t("animalDetail.noGainHelp")}
            </p>
            <button
              onClick={() => setShowWeighingModal(true)}
              className="inline-flex items-center gap-2 bg-verde text-white text-sm font-medium px-4 py-2.5 rounded-lg cursor-pointer"
            >
              <Plus size={16} /> {t("animalDetail.addWeighing")}
            </button>
          </div>
        )}

        {/* Histórico de pesagens */}
        <div className="bg-card border border-borda rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-medium text-texto">{t("animalDetail.weighings")}</p>
            <button
              onClick={() => setShowWeighingModal(true)}
              className="flex items-center gap-2 bg-verde text-white text-sm font-medium px-3 py-2 rounded-lg cursor-pointer"
            >
              <Plus size={16} /> {t("animalDetail.addWeighing")}
            </button>
          </div>

          {weighings.length === 0 ? (
            <p className="text-texto-suave text-sm">
              {t("animalDetail.noWeighings")}
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
                      {t("units.kgValue", { value: formatNumber(Number(w.weightKg)) })}
                    </span>
                    <button
                      onClick={() => setEditingWeighing(w)}
                      title={t("animalDetail.editWeighing")}
                      aria-label={t("animalDetail.editWeighing")}
                      className="text-texto-leve hover:text-verde cursor-pointer"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeletingWeighing(w)}
                      title={t("animalDetail.deleteWeighing")}
                      aria-label={t("animalDetail.deleteWeighing")}
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
          <p className="font-medium text-texto mb-4">{t("animalDetail.sanitary")}</p>
          {applications.length === 0 ? (
            <p className="text-texto-suave text-sm">
              {t("animalDetail.noApplications")}
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
                        {t("animalDetail.applicationLine", {
                          type: t(`product.type.${app.product.type}`),
                          date: formatDate(app.date),
                        })}
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
          <p className="font-medium text-texto mb-4">{t("animalDetail.finance")}</p>

          {/* Resultado apurado (real se vendido, estimado se vivo) */}
          {result && result.resultType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-bege p-4">
                <p className="text-sm text-texto-suave mb-1">{t("animalDetail.purchaseCost")}</p>
                <p className="text-xl font-medium text-texto">
                  {result.purchaseCost !== null
                    ? formatMoney(result.purchaseCost)
                    : t("animalDetail.notInformed")}
                </p>
              </div>
              <div className="rounded-xl bg-bege p-4">
                <p className="text-sm text-texto-suave mb-1">
                  {result.resultType === "REALIZED"
                    ? t("animalDetail.saleRevenue")
                    : t("animalDetail.estimatedValue")}
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
                  {result.resultType === "ESTIMATED"
                    ? t("animalDetail.resultEstimated")
                    : t("animalDetail.result")}
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
              {t("animalDetail.resultHelp")}
            </p>
          )}

          {/* Linhas: compra, venda e — se ainda vivo — preço estimado */}
          <div className="flex flex-col divide-y divide-borda">
            {/* Compra */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-texto">{t("animalDetail.purchase")}</p>
                <p className="text-xs text-texto-suave">
                  {purchase
                    ? t("animalDetail.tradeLine", {
                        date: formatDate(purchase.date),
                        weight: t("units.kgValue", { value: formatNumber(Number(purchase.weightKg)) }),
                        price: t("units.perKg", { value: formatMoney(Number(purchase.pricePerKg)) }),
                      })
                    : t("animalDetail.notRegistered")}
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
                    title={t("animalDetail.editPurchase")}
                    aria-label={t("animalDetail.editPurchase")}
                    className="text-texto-leve hover:text-verde cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeletingTrade("purchase")}
                    title={t("animalDetail.removePurchase")}
                    aria-label={t("animalDetail.removePurchase")}
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
                  <Plus size={15} /> {t("animalDetail.register")}
                </button>
              )}
            </div>

            {/* Venda */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-texto">{t("animalDetail.sale")}</p>
                <p className="text-xs text-texto-suave">
                  {sale
                    ? t("animalDetail.tradeLine", {
                        date: formatDate(sale.date),
                        weight: t("units.kgValue", { value: formatNumber(Number(sale.weightKg)) }),
                        price: t("units.perKg", { value: formatMoney(Number(sale.pricePerKg)) }),
                      })
                    : animal.status === "DEAD"
                      ? t("animalDetail.deadAnimal")
                      : t("animalDetail.notRegistered")}
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
                    title={t("animalDetail.editSale")}
                    aria-label={t("animalDetail.editSale")}
                    className="text-texto-leve hover:text-verde cursor-pointer"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeletingTrade("sale")}
                    title={t("animalDetail.undoSale")}
                    aria-label={t("animalDetail.undoSale")}
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
                  <Plus size={15} /> {t("animalDetail.register")}
                </button>
              )}
            </div>

            {/* Preço estimado — só faz sentido enquanto o animal está vivo e não vendido */}
            {!sale && animal.status !== "DEAD" && (
              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-texto">
                    {t("animalDetail.estimatedPrice")}
                  </p>
                  <p className="text-xs text-texto-suave">
                    {animal.estimatedPricePerKg
                      ? t("units.perKg", { value: formatMoney(Number(animal.estimatedPricePerKg)) })
                      : t("animalDetail.notInformed")}
                  </p>
                </div>
                <button
                  onClick={() => setShowPriceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
                >
                  {animal.estimatedPricePerKg ? (
                    <>
                      <Pencil size={15} /> {t("animalDetail.change")}
                    </>
                  ) : (
                    <>
                      <Plus size={15} /> {t("animalDetail.inform")}
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
              showToast(t("animalDetail.weighingCreated"));
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
              showToast(t("animalDetail.weighingUpdated"));
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
                {t("animalDetail.deleteWeighingTitle")}
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                {t("animalDetail.deleteWeighingBody", {
                  date: formatDate(deletingWeighing.date),
                  weight: t("units.kgValue", { value: formatNumber(Number(deletingWeighing.weightKg)) }),
                })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingWeighing(null)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeleteWeighing}
                  disabled={deletingWeighingLoading}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deletingWeighingLoading ? t("common.deleting") : t("common.delete")}
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
              showToast(t("animalDetail.statusUpdated"));
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
              showToast(t("animalDetail.animalDeleted"));
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
              const isSale = tradeModal.kind === "sale";
              setTradeModal(null);
              loadData();
              showToast(
                isSale
                  ? t(wasEdit ? "animalDetail.saleUpdated" : "animalDetail.saleCreated")
                  : t(wasEdit ? "animalDetail.purchaseUpdated" : "animalDetail.purchaseCreated"),
              );
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
              showToast(t("animalDetail.priceUpdated"));
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
                  ? t("animalDetail.removePurchaseTitle")
                  : t("animalDetail.undoSaleTitle")}
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                {deletingTrade === "purchase"
                  ? t("animalDetail.removePurchaseBody")
                  : t("animalDetail.undoSaleBody")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingTrade(null)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeleteTrade}
                  disabled={deletingTradeLoading}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deletingTradeLoading
                    ? t("animalDetail.processing")
                    : deletingTrade === "purchase"
                      ? t("animalDetail.remove")
                      : t("animalDetail.undo")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}