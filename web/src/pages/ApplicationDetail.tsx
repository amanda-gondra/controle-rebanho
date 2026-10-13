import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Syringe, Pill, Pencil, Trash2, Bell } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getApplication, deleteApplication } from "../services/sanitary.js";
import { EditApplicationModal } from "../components/EditApplicationModal.js";
import type { Application } from "../types/animal.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { formatDate } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { RichText } from "../i18n/RichText.js";
import { useToast } from "../components/ToastProvider.js";

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadData() {
    if (!id) return;
    getApplication(id)
      .then((data) => setApplication(data))
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [id]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteApplication(id);
      showToast(t("applicationDetail.deleted"));
      navigate("/manejo");
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
          <p className="text-texto-suave">{t("common.loading")}</p>
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
            <button
              onClick={() => navigate("/manejo")}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer"
            >
              {t("applicationDetail.backToSanitary")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const isVaccine = application.product.type === "VACCINE";
  const animals = application.animals ?? [];

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/manejo")}
            title={t("applicationDetail.backToSanitary")}
            aria-label={t("applicationDetail.backToSanitary")}
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <span
              className={`flex items-center justify-center w-11 h-11 rounded-full ${
                isVaccine ? "bg-verde-claro text-verde" : "bg-bege text-couro"
              }`}
            >
              {isVaccine ? <Syringe size={20} /> : <Pill size={20} />}
            </span>
            <div>
              <h1 className="text-2xl font-medium text-texto">
                {application.product.name}
              </h1>
              <p className="text-texto-suave">
                {t(`product.type.${application.product.type}`)} ·{" "}
                {formatDate(application.date)}
                {application.notes ? ` · ${application.notes}` : ""}
              </p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              title={t("applicationDetail.editLabel")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Pencil size={16} /> {t("common.edit")}
            </button>
            <button
              onClick={() => setShowDelete(true)}
              title={t("applicationDetail.deleteLabel")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-alerta text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Trash2 size={16} /> {t("common.delete")}
            </button>
          </div>
        </div>

        {/* Aviso de reaplicação, se houver */}
        {application.reapplyDate && (
          <div className="bg-verde-claro border border-verde-nevoa rounded-xl px-5 py-3 mb-6 max-w-2xl flex items-center gap-2">
            <Bell size={18} className="text-verde" />
            <p className="text-sm text-texto">
              <RichText
                text={t("applicationDetail.reapplyScheduled", { date: formatDate(application.reapplyDate) })}
              />
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
            {animals.map((link) => (
              <div
                key={link.id}
                onClick={() =>
                  link.animal && navigate(`/animais/${link.animal.id}`)
                }
                className="flex items-center gap-4 py-3 cursor-pointer hover:bg-bege -mx-2 px-2 rounded-lg"
              >
                <span className="font-medium text-texto w-16">
                  {link.animal?.tag ?? "—"}
                </span>
                {link.animal && (
                  <span className="text-sm text-texto-suave">
                    {labelOf(link.animal.category, link.animal.sex)} ·{" "}
                    {sexLabel[link.animal.sex]}
                  </span>
                )}
              </div>
            ))}
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
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDelete(false)}
          >
            <div
              className="bg-card rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-medium text-texto mb-1">
                {t("applicationDetail.deleteTitle")}
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                {t("applicationDetail.deleteBody", {
                  product: application.product.name,
                  animals: t("common.animalsCount", { count: animals.length }),
                })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deleting ? t("common.deleting") : t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}