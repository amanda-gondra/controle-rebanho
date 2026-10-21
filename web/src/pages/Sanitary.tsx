import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Package, Bell, AlertCircle } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listApplications, listAlerts } from "../services/sanitary.js";
import { PRODUCT_TYPES, type Application, type ProductType } from "../types/animal.js";
import { ProductTypeIcon } from "../components/ProductTypeIcon.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { dismissReminder } from "../services/sanitary.js";
import { formatDate } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice } from "../navigation/listParams.js";

type TypeFilter = ProductType | "ALL";
const TYPE_VALUES: TypeFilter[] = ["ALL", ...PRODUCT_TYPES];

export function Sanitary() {
  const open = useOpen();
  const { account } = useAuth();
  const showToast = useToast();
  const [dismissing, setDismissing] = useState<Application | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissBusy, setDismissBusy] = useState(false);
  const [dismissError, setDismissError] = useState("");
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

        {/* Lembretes de reaplicação (D-40): saem só ao reaplicar a partir
            deles, ao dispensar ou sem animal ativo — nunca pelo tempo */}
        {!alertsError && (
        <section className="bg-card border border-borda rounded-xl p-5 mb-6 max-w-2xl" aria-labelledby="reminders-title">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-verde" aria-hidden="true" />
            <h2 id="reminders-title" className="font-medium text-texto">{t("sanitary.reapplications")}</h2>
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-texto-suave">
              {t("sanitary.noReminders", { count: account?.farm.settings.reapplyAlertDays ?? 7 })}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {alerts.map((app) => (
                <li
                  key={app.id}
                  className={`px-4 py-3 rounded-lg border ${app.overdue ? "bg-[#FBEEEA] border-[#E7C3B8]" : "bg-bege border-borda-chip"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link to={`/aplicacoes/${app.id}`} state={originState} className="flex items-center gap-3 min-w-0">
                      <AlertCircle size={18} className={app.overdue ? "text-alerta shrink-0" : "text-couro shrink-0"} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-medium text-texto text-sm">{app.product.name}</span>
                        <span className="block text-xs text-texto-suave">
                          {app.reapplyDate &&
                            t(app.overdue ? "sanitary.overdueSince" : "sanitary.dueOn", { date: formatDate(app.reapplyDate) })}
                          {" · "}
                          {t("sanitary.activeOfTotal", {
                            active: app.activeAnimalsCount ?? 0,
                            total: app._count?.animals ?? 0,
                          })}
                        </span>
                      </span>
                    </Link>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        app.overdue ? "bg-[#FAEEDA] text-[#854F0B]" : "bg-verde-claro text-verde-escuro"
                      }`}
                    >
                      {app.overdue ? t("sanitary.overdue") : t("sanitary.soon")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => open(`/aplicacoes/nova?reaplicar=${app.id}`)}
                      className={buttonClass("primary", "text-sm px-3 py-2")}
                    >
                      {t("sanitary.reapply")}
                    </button>
                    <button type="button" onClick={() => setDismissing(app)} className={buttonClass("secondary", "text-sm px-3 py-2")}>
                      {t("sanitary.dismiss")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        {/* Filtro por tipo */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TYPE_VALUES.map((value) => (
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
                  <ProductTypeIcon type={app.product.type} size={18} className="w-10 h-10" />
                  <div>
                    <p className="font-medium text-texto">{app.product.name}</p>
                    <p className="text-sm text-texto-suave">
                      {t(`product.type.${app.product.type}`)} · {formatDate(app.date)}
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
        {dismissing && (
          <ConfirmDialog
            title={t("sanitary.dismissTitle")}
            confirmLabel={t("sanitary.dismiss")}
            busyLabel={t("sanitary.dismissing")}
            busy={dismissBusy}
            error={dismissError}
            onClose={() => {
              setDismissing(null);
              setDismissReason("");
              setDismissError("");
            }}
            onConfirm={async () => {
              setDismissBusy(true);
              setDismissError("");
              try {
                await dismissReminder(dismissing.id, dismissReason.trim() || undefined);
                showToast(t("sanitary.dismissed"));
                setDismissing(null);
                setDismissReason("");
                loadAlerts();
              } catch (err) {
                setDismissError(errorMessage(err, "sanitary.dismissFailed"));
              } finally {
                setDismissBusy(false);
              }
            }}
          >
            <p>
              {t("sanitary.dismissBody", {
                product: dismissing.product.name,
                date: dismissing.reapplyDate ? formatDate(dismissing.reapplyDate) : "",
              })}
            </p>
            <label htmlFor="dismiss-reason" className="block text-sm text-texto-suave mt-2">
              {t("sanitary.dismissReason")} <span className="text-texto-leve">{t("common.optional")}</span>
            </label>
            <input
              id="dismiss-reason"
              value={dismissReason}
              maxLength={200}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder={t("sanitary.dismissReasonPlaceholder")}
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </ConfirmDialog>
        )}
      </main>
    </div>
  );
}