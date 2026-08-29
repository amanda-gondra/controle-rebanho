import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Syringe, Pill, Pencil, Trash2, Bell } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getApplication, deleteApplication } from "../services/sanitary.js";
import { EditApplicationModal } from "../components/EditApplicationModal.js";
import type { Application } from "../types/animal.js";
import { categoryLabel, sexLabel } from "../types/labels.js";
import { formatDate } from "../types/format.js";
import { useToast } from "../components/ToastProvider.js";

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
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
      showToast("Aplicação excluída.");
      navigate("/manejo");
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  }

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

  if (notFound || !application) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-medium text-texto mb-2">
              Não encontramos esta aplicação
            </h2>
            <button
              onClick={() => navigate("/manejo")}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer"
            >
              Voltar para o manejo
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
            title="Voltar para o manejo"
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
                {isVaccine ? "Vacina" : "Vermífugo"} ·{" "}
                {formatDate(application.date)}
                {application.notes ? ` · ${application.notes}` : ""}
              </p>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              title="Editar aplicação"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Pencil size={16} /> Editar
            </button>
            <button
              onClick={() => setShowDelete(true)}
              title="Excluir aplicação"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-borda-chip text-alerta text-sm font-medium hover:bg-bege cursor-pointer"
            >
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        </div>

        {/* Aviso de reaplicação, se houver */}
        {application.reapplyDate && (
          <div className="bg-verde-claro border border-verde-nevoa rounded-xl px-5 py-3 mb-6 max-w-2xl flex items-center gap-2">
            <Bell size={18} className="text-verde" />
            <p className="text-sm text-texto">
              Reaplicação marcada para{" "}
              <span className="font-medium">
                {formatDate(application.reapplyDate)}
              </span>
            </p>
          </div>
        )}

        {/* Lista dos animais do lote */}
        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
          <p className="font-medium text-texto mb-4">
            Animais aplicados{" "}
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
                    {categoryLabel[link.animal.category]} ·{" "}
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
              showToast("Aplicação atualizada.");
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
                Excluir aplicação?
              </h2>
              <p className="text-sm text-texto-suave mb-5">
                Isso apaga o registro desta aplicação de{" "}
                {application.product.name} ({animals.length}{" "}
                {animals.length === 1 ? "animal" : "animais"}) e não dá para
                desfazer. O histórico sanitário desses animais será atualizado.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDelete(false)}
                  className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl bg-alerta text-white font-medium cursor-pointer disabled:opacity-60"
                >
                  {deleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}