import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Syringe, Pill, Package } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listApplications } from "../services/sanitary.js";
import type { Application, ProductType } from "../types/animal.js";
import { formatDate } from "../types/format.js";

type TypeFilter = ProductType | "ALL";

export function Sanitary() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  useEffect(() => {
    setLoading(true);
    listApplications(typeFilter === "ALL" ? undefined : typeFilter)
      .then((data) => setApplications(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-medium text-texto">
              Manejo sanitário
            </h1>
            <p className="text-texto-suave">
              Histórico de vacinas e vermífugos aplicados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/produtos")}
              className="flex items-center gap-2 bg-card border border-borda-chip text-texto-suave font-medium px-4 py-2.5 rounded-xl cursor-pointer hover:bg-bege"
            >
              <Package size={18} /> Produtos
            </button>
            <button
              onClick={() => navigate("/aplicacoes/nova")}
              className="flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus size={18} /> Registrar aplicação
            </button>
          </div>
        </div>

        {/* Filtro por tipo */}
        <div className="flex gap-2 mb-6">
          {(
            [
              ["ALL", "Todos"],
              ["VACCINE", "Vacinas"],
              ["DEWORMER", "Vermífugos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
                typeFilter === value
                  ? "bg-verde border-verde text-white"
                  : "bg-card border-borda-chip text-texto-suave"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista de aplicações (histórico por evento) */}
        {loading ? (
          <p className="text-texto-suave">Carregando...</p>
        ) : applications.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-10 text-center max-w-xl">
            <p className="text-texto font-medium mb-1">
              Nenhuma aplicação registrada
            </p>
            <p className="text-texto-suave text-sm mb-4">
              Registre a primeira vacina ou vermífugo do seu rebanho.
            </p>
            <button
              onClick={() => navigate("/aplicacoes/nova")}
              className="inline-flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus size={18} /> Registrar aplicação
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-2xl">
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/aplicacoes/${app.id}`)}
                className="bg-card border border-borda rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:border-verde-nevoa"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      app.product.type === "VACCINE"
                        ? "bg-verde-claro text-verde"
                        : "bg-bege text-couro"
                    }`}
                  >
                    {app.product.type === "VACCINE" ? (
                      <Syringe size={18} />
                    ) : (
                      <Pill size={18} />
                    )}
                  </span>
                  <div>
                    <p className="font-medium text-texto">{app.product.name}</p>
                    <p className="text-sm text-texto-suave">
                      {formatDate(app.date)}
                      {app.notes ? ` · ${app.notes}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-texto-suave">
                  {app._count?.animals ?? 0}{" "}
                  {app._count?.animals === 1 ? "animal" : "animais"}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}