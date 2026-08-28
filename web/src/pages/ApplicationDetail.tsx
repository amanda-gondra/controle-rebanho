import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Syringe, Pill } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getApplication } from "../services/sanitary.js";
import type { Application } from "../types/animal.js";
import { categoryLabel, sexLabel } from "../types/labels.js";
import { formatDate } from "../types/format.js";

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getApplication(id)
      .then((data) => setApplication(data))
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else console.error(err);
      })
      .finally(() => setLoading(false));
  }, [id]);

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
          <div className="flex items-center gap-3">
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
        </div>

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
      </main>
    </div>
  );
}