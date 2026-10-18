import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Syringe, Pill, Package, Bell, AlertCircle } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listApplications, listAlerts } from "../services/sanitary.js";
import type { Application, ProductType } from "../types/animal.js";
import { formatDate } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice } from "../navigation/listParams.js";

type TypeFilter = ProductType | "ALL";
const TYPE_VALUES: TypeFilter[] = ["ALL", "VACCINE", "DEWORMER"];

export function Sanitary() {
  const open = useOpen();
  const originState = useOriginState();
  const [applications, setApplications] = useState<Application[]>([]);
  const [alerts, setAlerts] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [alertsError, setAlertsError] = useState(false);
  // O filtro de tipo fica no endereço (volta igual depois de abrir uma aplicação)
  const [params, setParams] = useSearchParams();
  const typeFilter = readChoice(params, "type", TYPE_VALUES, "ALL");
  const setTypeFilter = (value: TypeFilter) =>
    setParams(buildParams({ type: value }, { type: "ALL" }), { replace: true });

  const loadApplications = useCallback(() => {
    setLoading(true);
    setLoadError("");
    listApplications(typeFilter === "ALL" ? undefined : typeFilter)
      .then((data) => setApplications(data))
      .catch((err) => setLoadError(errorMessage(err, "sanitary.loadFailed")))
      .finally(() => setLoading(false));
  }, [typeFilter]);
  useEffect(loadApplications, [loadApplications]);

  // os alertas não dependem do filtro de tipo — carrega uma vez
  const loadAlerts = useCallback(() => {
    setAlertsError(false);
    listAlerts()
      .then((data) => setAlerts(data))
      .catch(() => setAlertsError(true));
  }, []);
  useEffect(loadAlerts, [loadAlerts]);

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        {/* Cabeçalho */}
        <PageHeader
          title={t("sanitary.title")}
          subtitle={t("sanitary.subtitle")}
          actions={
            <>
              <button type="button" onClick={() => open("/produtos")} className={buttonClass("secondary")}>
                <Package size={18} aria-hidden="true" /> {t("sanitary.products")}
              </button>
              <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("primary")}>
                <Plus size={18} aria-hidden="true" /> {t("sanitary.newApplication")}
              </button>
            </>
          }
        />

        {alertsError && (
          <div className="mb-6 max-w-2xl">
            <LoadError compact message={t("sanitary.alertsLoadFailed")} onRetry={loadAlerts} />
          </div>
        )}

        {/* Alertas de reaplicação */}
        {alerts.length > 0 && (
          <div className="bg-card border border-borda rounded-xl p-5 mb-6 max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={18} className="text-verde" />
              <p className="font-medium text-texto">{t("sanitary.reapplications")}</p>
            </div>
            <div className="flex flex-col gap-2">
              {alerts.map((app) => (
                <Link
                  key={app.id}
                  to={`/aplicacoes/${app.id}`}
                  state={originState}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                    app.overdue
                      ? "bg-[#FBEEEA] border-[#E7C3B8]"
                      : "bg-bege border-borda-chip"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle
                      size={18}
                      className={app.overdue ? "text-alerta" : "text-couro"}
                    />
                    <div>
                      <p className="font-medium text-texto text-sm">
                        {app.product.name}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {t(app.overdue ? "sanitary.overdueOn" : "sanitary.reapplyOn", {
                          animals: t("common.animalsCount", { count: app._count?.animals ?? 0 }),
                          date: app.reapplyDate ? formatDate(app.reapplyDate) : "",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      app.overdue
                        ? "bg-[#FAEEDA] text-[#854F0B]"
                        : "bg-verde-claro text-verde-escuro"
                    }`}
                  >
                    {app.overdue ? t("sanitary.overdue") : t("sanitary.soon")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filtro por tipo */}
        <div className="flex gap-2 mb-6">
          {(["ALL", "VACCINE", "DEWORMER"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={typeFilter === value}
              onClick={() => setTypeFilter(value)}
              className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
                typeFilter === value
                  ? "bg-verde border-verde text-white"
                  : "bg-card border-borda-chip text-texto-suave"
              }`}
            >
              {t(`sanitary.filter${value}`)}
            </button>
          ))}
        </div>

        {/* Lista de aplicações (histórico por evento) */}
        {loading ? (
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        ) : loadError ? (
          <div className="max-w-2xl">
            <LoadError message={loadError} onRetry={loadApplications} />
          </div>
        ) : applications.length === 0 && typeFilter !== "ALL" ? (
          <div className="bg-card border border-borda rounded-xl p-10 text-center max-w-xl">
            <p className="text-texto-suave mb-3">{t("sanitary.noMatch")}</p>
            <button type="button" onClick={() => setTypeFilter("ALL")} className={buttonClass("secondary")}>
              {t("herd.clearFilters")}
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-10 text-center max-w-xl">
            <p className="text-texto font-medium mb-1">{t("sanitary.empty")}</p>
            <p className="text-texto-suave text-sm mb-4">{t("sanitary.emptyHelp")}</p>
            <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("sanitary.newApplication")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-2xl">
            {applications.map((app) => (
              <Link
                key={app.id}
                to={`/aplicacoes/${app.id}`}
                state={originState}
                className="bg-card border border-borda rounded-xl px-5 py-4 flex items-center justify-between gap-3 hover:border-verde-nevoa"
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
                  {t("common.animalsCount", { count: app._count?.animals ?? 0 })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}