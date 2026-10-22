import { invalidateReminderCount } from "../hooks/useReminderCount.js";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Trash2, Bell } from "lucide-react";
import { ProductTypeIcon } from "../components/ProductTypeIcon.js";
import { Sidebar } from "../components/Sidebar.js";
import { getApplication, deleteApplication } from "../services/sanitary.js";
import { EditApplicationModal } from "../components/EditApplicationModal.js";
import type { Application } from "../types/animal.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { formatDate, formatNumber } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { RichText } from "../i18n/RichText.js";
import { useToast } from "../components/ToastProvider.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin, useOriginState } from "../navigation/hooks.js";

export function ApplicationDetail() {
  const { id } = useParams();
  const { goBack } = useOrigin("/manejo");
  const originState = useOriginState();
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(() => {
    if (!id) return;
    getApplication(id)
      .then((data) => {
        setApplication(data);
        setLoadError("");
      })
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else setLoadError(errorMessage(err, "applicationDetail.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    loadData();
  }, [loadData]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteApplication(id);
      invalidateReminderCount(); // o sino do topo recalcula
      showToast(t("applicationDetail.deleted"));
      goBack();
    } catch (err) {
      // antes o erro só ia para o console: agora a pessoa fica sabendo
      showToast(errorMessage(err, "applicationDetail.deleteFailed"));
      setDeleting(false);
    }
  }

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

  if (loadError && !application) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <PageHeader title={t("applicationDetail.title")} backFallback="/manejo" backLabel={t("applicationDetail.backToSanitary")} />
          <LoadError
            message={loadError}
            onRetry={() => {
              setLoading(true);
              loadData();
            }}
          />
        </main>
      </div>
    );
  }

  if (notFound || !application) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-medium text-texto mb-2">
              {t("applicationDetail.notFound")}
            </h2>
            <Link to="/manejo" className={buttonClass("primary")}>
              {t("applicationDetail.backToSanitary")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Detalhes do lançamento: dose, partida, carência, reaplicação (D-12, D-40)
  const details = [
    application.doseAmount && application.doseUnit
      ? t("applicationDetail.dose", {
          dose: `${formatNumber(Number(application.doseAmount))} ${t(`product.doseUnit.${application.doseUnit}`)}`,
        })
      : null,
    application.batchNumber ? t("applicationDetail.batch", { batch: application.batchNumber }) : null,
    application.withdrawalEndDate
      ? t("product.withdrawal.until", { date: formatDate(application.withdrawalEndDate) })
      : t("product.withdrawal.notInformed"),
  ].filter(Boolean);
  const reapplied = application.reappliedBy?.[0];
  const animals = application.animals ?? [];

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <PageHeader
          title={
            <span className="flex items-center gap-3">
              <ProductTypeIcon type={application.product.type} size={20} className="w-11 h-11" />
              {application.product.name}
              {application.product.archivedAt && (
                <span className="text-sm font-normal text-texto-leve">{t("applicationDetail.archivedProduct")}</span>
              )}
            </span>
          }
          subtitle={
            <>
              {t(`product.type.${application.product.type}`)} · {formatDate(application.date)}
              {application.notes ? ` · ${application.notes}` : ""}
            </>
          }
          backFallback="/manejo"
          backLabel={t("applicationDetail.backToSanitary")}
          actions={
            <>
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                title={t("applicationDetail.editLabel")}
                className={buttonClass("secondary", "text-sm px-3 py-2")}
              >
                <Pencil size={16} aria-hidden="true" /> {t("common.edit")}
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                title={t("applicationDetail.deleteLabel")}
                className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
              >
                <Trash2 size={16} aria-hidden="true" /> {t("common.delete")}
              </button>
            </>
          }
        />

        <p className="text-sm text-texto-suave mb-4 max-w-2xl">{details.join(" · ")}</p>

        {/* Aviso de reaplicação: marcada, reaplicada ou lembrete dispensado */}
        {application.reapplyDate && (
          <div className="bg-verde-claro border border-verde-nevoa rounded-xl px-5 py-3 mb-6 max-w-2xl flex items-center gap-2">
            <Bell size={18} className="text-verde" />
            <p className="text-sm text-texto">
              <RichText
                text={t("applicationDetail.reapplyScheduled", { date: formatDate(application.reapplyDate) })}
              />
              {reapplied && (
                <>
                  {" · "}
                  <Link to={`/aplicacoes/${reapplied.id}`} state={originState} className="text-verde font-medium underline">
                    {t("applicationDetail.reappliedOn", { date: formatDate(reapplied.date) })}
                  </Link>
                </>
              )}
              {!reapplied && application.reminderDismissedAt && (
                <>
                  {" · "}
                  {application.reminderDismissReason
                    ? t("applicationDetail.dismissedWithReason", {
                        date: formatDate(application.reminderDismissedAt),
                        reason: application.reminderDismissReason,
                      })
                    : t("applicationDetail.dismissedOn", { date: formatDate(application.reminderDismissedAt) })}
                </>
              )}
            </p>
          </div>
        )}

        {/* Lista dos animais do lote */}
        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
          <p className="font-medium text-texto mb-4">
            {t("applicationDetail.animalsApplied")}{" "}
            <span className="text-texto-suave font-normal">
              ({animals.length})
            </span>
          </p>
          <div className="flex flex-col divide-y divide-borda">
            {animals.map((link) =>
              link.animal ? (
                <Link
                  key={link.id}
                  to={`/animais/${link.animal.id}`}
                  state={originState}
                  className="flex items-center gap-4 py-3 hover:bg-bege -mx-2 px-2 rounded-lg"
                >
                  <span className="font-medium text-texto w-16">{link.animal.tag}</span>
                  <span className="text-sm text-texto-suave">
                    {labelOf(link.animal.category, link.animal.sex)} · {sexLabel[link.animal.sex]}
                  </span>
                </Link>
              ) : (
                <div key={link.id} className="flex items-center gap-4 py-3 -mx-2 px-2">
                  <span className="font-medium text-texto w-16">—</span>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Modal de editar aplicação */}
        {showEdit && (
          <EditApplicationModal
            application={application}
            onClose={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              loadData();
              showToast(t("applicationDetail.updated"));
            }}
          />
        )}

        {/* Confirmação de excluir aplicação */}
        {showDelete && (
          <ConfirmDialog
            title={t("applicationDetail.deleteTitle")}
            confirmLabel={t("common.delete")}
            busyLabel={t("common.deleting")}
            busy={deleting}
            danger
            onConfirm={handleDelete}
            onClose={() => setShowDelete(false)}
          >
            {t("applicationDetail.deleteBody", {
              product: application.product.name,
              animals: t("common.animalsCount", { count: animals.length }),
            })}
          </ConfirmDialog>
        )}
      </main>
    </div>
  );
}
