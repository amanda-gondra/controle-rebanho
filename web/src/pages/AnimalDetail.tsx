import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Pencil, RefreshCw, Trash2, Syringe, Pill } from "lucide-react";
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
import { getAnimalResult } from "../services/trades.js";
import type {
  Animal,
  Weighing,
  WeightGain,
  Application,
} from "../types/animal.js";
import type { AnimalResult } from "../types/trade.js";
import {
  sexLabel,
  statusLabel,
  statusStyle,
} from "../types/labels.js";
import { formatDate, formatMonthYear, formatNumber } from "../types/format.js";
import { WeighingModal } from "../components/WeighingModal.js";
import { EditWeighingModal } from "../components/EditWeighingModal.js";
import { StatusModal } from "../components/StatusModal.js";
import { DeleteModal } from "../components/DeleteModal.js";
import { AnimalTradesCard } from "../components/AnimalTradesCard.js";
import { useToast } from "../components/ToastProvider.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOpen, useOrigin, useOriginState } from "../navigation/hooks.js";

export function AnimalDetail() {
  const { id } = useParams(); // pega o :id do endereço
  const open = useOpen();
  const originState = useOriginState();
  const { goBack } = useOrigin("/");
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [weighings, setWeighings] = useState<Weighing[]>([]);
  const [gain, setGain] = useState<WeightGain | null>(null);
  // Por que o ganho não foi calculado (código vindo da API)
  const [gainUnavailableCode, setGainUnavailableCode] = useState<string | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [result, setResult] = useState<AnimalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Falhas de carga: da ficha inteira ou de uma seção (cada uma com "Tentar de novo")
  const [loadError, setLoadError] = useState("");
  const [weighingsError, setWeighingsError] = useState(false);
  const [applicationsError, setApplicationsError] = useState(false);
  const [showWeighingModal, setShowWeighingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingWeighing, setEditingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighing, setDeletingWeighing] = useState<Weighing | null>(null);
  const [deletingWeighingLoading, setDeletingWeighingLoading] = useState(false);
  // Busca (ou rebusca) todos os dados do animal.
  const loadData = useCallback(() => {
    if (!id) return;
    getAnimal(id)
      .then((data) => {
        setAnimal(data);
        setLoadError("");
      })
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else setLoadError(errorMessage(err, "animalDetail.loadFailed"));
      })
      .finally(() => setLoading(false));
    listWeighings(id)
      .then((data) => {
        setWeighings(data);
        setWeighingsError(false);
      })
      .catch(() => setWeighingsError(true));
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
      .then((data) => {
        setApplications(data);
        setApplicationsError(false);
      })
      .catch(() => setApplicationsError(true));
    // Compra, venda e diferença (G5)
    getAnimalResult(id)
      .then((data) => setResult(data))
      .catch(() => setResult(null));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setLoadError("");
    loadData();
  }, [loadData]);

  function retryAll() {
    setLoading(true);
    setLoadError("");
    loadData();
  }

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

  // Enquanto carrega
  if (loading) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  // Falha de rede/servidor: não é "não encontrado"
  if (loadError && !animal) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <PageHeader title={t("animalDetail.title")} backFallback="/" backLabel={t("animalDetail.backToHerd")} />
          <LoadError message={loadError} onRetry={retryAll} />
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
            <Link to="/" className={buttonClass("primary")}>
              {t("animalDetail.backToHerd")}
            </Link>
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

  // Saída (D-27): o animal vendido/morto não recebe pesagens novas (RN-ANIMAL-012)
  const hasExited = animal.status !== "ACTIVE";
  let exitText = t("animalDetail.exitNoDate");
  if (animal.exitDate) {
    const date = formatDate(animal.exitDate);
    if (animal.status === "SOLD") exitText = t("animalDetail.exitSold", { date });
    else if (animal.deathCause) {
      exitText = t("animalDetail.exitDeadWithCause", {
        date,
        cause: animal.deathCause,
        certainty: t(`animalDetail.certaintyLower${animal.deathCauseCertainty ?? "NOT_INFORMED"}`),
      });
    } else exitText = t("animalDetail.exitDead", { date });
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <span className="whitespace-nowrap">{animal.tag}</span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[animal.status]}`}>
                {statusLabel[animal.status]}
              </span>
            </span>
          }
          subtitle={t("animalDetail.summary", {
            category: labelOf(animal.category, animal.sex),
            sex: animal.castrated
              ? `${sexLabel[animal.sex]} ${t("animalDetail.castratedSuffix")}`
              : sexLabel[animal.sex],
            breed: animal.breed ?? t("animalDetail.noBreed"),
          })}
          backFallback="/"
          backLabel={t("animalDetail.backToHerd")}
          actions={
            <>
              <button
                type="button"
                onClick={() => open(`/animais/${animal.id}/editar`)}
                title={t("animalDetail.editLabel")}
                className={buttonClass("secondary", "text-sm px-3 py-2")}
              >
                <Pencil size={16} aria-hidden="true" /> {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                title={t("animalDetail.statusLabel")}
                className={buttonClass("secondary", "text-sm px-3 py-2")}
              >
                <RefreshCw size={16} aria-hidden="true" /> {t("animalDetail.changeStatus")}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                title={t("animalDetail.deleteLabel")}
                className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
              >
                <Trash2 size={16} aria-hidden="true" /> {t("common.delete")}
              </button>
            </>
          }
        >
          <p className="text-sm text-texto-leve">{birthText}</p>
          {/* Faixa de saída (D-27): quando e por quê o animal saiu */}
          {animal.status !== "ACTIVE" && (
            <p role="status" className="mt-2 inline-block text-sm rounded-lg bg-card border border-borda text-texto px-3 py-1.5">
              {exitText}
            </p>
          )}
        </PageHeader>

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
              type="button"
              onClick={() => setShowWeighingModal(true)}
              disabled={hasExited}
              title={hasExited ? t("animalDetail.weighingDisabled") : undefined}
              className={buttonClass("primary", "text-sm")}
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
              type="button"
              onClick={() => setShowWeighingModal(true)}
              disabled={hasExited}
              title={hasExited ? t("animalDetail.weighingDisabled") : undefined}
              className={buttonClass("primary", "text-sm px-3 py-2")}
            >
              <Plus size={16} /> {t("animalDetail.addWeighing")}
            </button>
          </div>

          {hasExited && (
            <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-3">
              {t("animalDetail.weighingDisabled")}
            </p>
          )}
          {weighingsError ? (
            <LoadError compact message={t("animalDetail.weighingsLoadFailed")} onRetry={loadData} />
          ) : weighings.length === 0 ? (
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
                    {w.source === "MANUAL" ? (
                      <>
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
                      </>
                    ) : (
                      // Pesagem de compra/venda só muda pela negociação (RN-PES-009)
                      <span className="text-xs text-texto-leve">{t("animalDetail.weighingFromTrade")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manejo sanitário (vacinas e vermífugos deste animal) */}
        <div className="bg-card border border-borda rounded-xl p-6">
          <p className="font-medium text-texto mb-4">{t("animalDetail.sanitary")}</p>
          {applicationsError ? (
            <LoadError compact message={t("animalDetail.applicationsLoadFailed")} onRetry={loadData} />
          ) : applications.length === 0 ? (
            <p className="text-texto-suave text-sm">
              {t("animalDetail.noApplications")}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-borda">
              {applications.map((app) => {
                const isVaccine = app.product.type === "VACCINE";
                return (
                  <Link
                    key={app.id}
                    to={`/aplicacoes/${app.id}`}
                    state={originState}
                    className="flex items-center gap-3 py-3 hover:bg-bege -mx-2 px-2 rounded-lg"
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
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Compra e venda (G5) — resultado sem custos */}
        <AnimalTradesCard animal={animal} result={result} />

        {/* Modal de registrar pesagem */}
        {showWeighingModal && (
          <WeighingModal
            animalId={animal.id}
            animalTag={animal.tag}
            onClose={() => setShowWeighingModal(false)}
            onEditExisting={(date) => {
              // D-33: já tem pesagem nesse dia → abre a edição dela
              const existing = weighings.find((w) => w.date.slice(0, 10) === date);
              setShowWeighingModal(false);
              if (existing) setEditingWeighing(existing);
            }}
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
          <ConfirmDialog
            title={t("animalDetail.deleteWeighingTitle")}
            confirmLabel={t("common.delete")}
            busyLabel={t("common.deleting")}
            busy={deletingWeighingLoading}
            danger
            onConfirm={handleDeleteWeighing}
            onClose={() => setDeletingWeighing(null)}
          >
            {t("animalDetail.deleteWeighingBody", {
              date: formatDate(deletingWeighing.date),
              weight: t("units.kgValue", { value: formatNumber(Number(deletingWeighing.weightKg)) }),
            })}
          </ConfirmDialog>
        )}

        {/* Modal de mudar status */}
        {showStatusModal && (
          <StatusModal
            animal={animal}
            hasSale={!!result?.sale}
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
              goBack();
            }}
          />
        )}

      </main>
    </div>
  );
}