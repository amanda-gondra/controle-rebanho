import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Package, Bell, AlertCircle, Syringe, CalendarClock, ChevronRight, Search, UserRound, CalendarCheck } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listApplications, listAlerts, getApplicationsSummary, dismissReminder } from "../services/sanitary.js";
import { PRODUCT_TYPES, type Application, type ApplicationsSummary, type ProductType } from "../types/animal.js";
import { ProductTypeIcon } from "../components/ProductTypeIcon.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { daysBetween, formatDate, todayInTimeZone } from "../types/format.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice, readText } from "../navigation/listParams.js";
import { invalidateReminderCount } from "../hooks/useReminderCount.js";
import { StatCard } from "../components/ui/StatCard.js";
import { SectionCard } from "../components/ui/SectionCard.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { Pagination } from "../components/ui/Pagination.js";
import { PeriodFilter, type Period } from "../components/ui/PeriodFilter.js";
import { CowIcon } from "../components/ui/CowIcon.js";
import { IconCircle } from "../components/ui/IconCircle.js";
import { reminderTone } from "../components/ui/tones.js";

type TypeFilter = ProductType | "ALL";
const TYPE_VALUES: TypeFilter[] = ["ALL", ...PRODUCT_TYPES];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 10;

// Manejo sanitário: números do período, lembretes de reaplicação (com as
// ações de reaplicar e dispensar) e o histórico das aplicações com filtros.
// Tipo, busca e período ficam no endereço (voltam iguais depois de abrir uma
// aplicação).
export function Sanitary() {
  const open = useOpen();
  const { account } = useAuth();
  const showToast = useToast();
  const originState = useOriginState();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  const [params, setParams] = useSearchParams();
  const typeFilter = readChoice(params, "type", TYPE_VALUES, "ALL");
  const search = readText(params, "q", 60);
  const fromParam = params.get("from") ?? "";
  const toParam = params.get("to") ?? "";
  const validPeriod = ISO_DATE.test(fromParam) && ISO_DATE.test(toParam) && fromParam <= toParam;
  const from = validPeriod ? fromParam : undefined;
  const to = validPeriod ? toParam : undefined;
  const period: Period = from && to ? { from, to } : null;
  const update = useCallback(
    (next: { type?: TypeFilter; q?: string; period?: Period }) => {
      const merged = {
        type: next.type ?? typeFilter,
        q: next.q ?? search,
        ...("period" in next ? (next.period ?? { from: "", to: "" }) : { from: from ?? "", to: to ?? "" }),
      };
      setParams(buildParams(merged, { type: "ALL", q: "", from: "", to: "" }), { replace: true });
    },
    [typeFilter, search, from, to, setParams],
  );

  // busca: espera a pessoa parar de digitar antes de ir ao servidor
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => update({ q: searchInput.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const loadApplications = useCallback(() => {
    setLoading(true);
    setLoadError("");
    listApplications({ type: typeFilter === "ALL" ? undefined : typeFilter, q: search || undefined, from, to })
      .then((data) => {
        setApplications(data);
        setPage(1);
      })
      .catch((err) => setLoadError(errorMessage(err, "sanitary.loadFailed")))
      .finally(() => setLoading(false));
  }, [typeFilter, search, from, to]);
  useEffect(loadApplications, [loadApplications]);

  const [summary, setSummary] = useState<ApplicationsSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const loadSummary = useCallback(() => {
    setSummaryError(false);
    getApplicationsSummary({ from, to })
      .then(setSummary)
      .catch(() => setSummaryError(true));
  }, [from, to]);
  useEffect(loadSummary, [loadSummary]);

  // os lembretes não dependem dos filtros
  const [alerts, setAlerts] = useState<Application[]>([]);
  const [alertsError, setAlertsError] = useState(false);
  const loadAlerts = useCallback(() => {
    setAlertsError(false);
    listAlerts()
      .then(setAlerts)
      .catch(() => setAlertsError(true));
  }, []);
  useEffect(loadAlerts, [loadAlerts]);

  const [dismissing, setDismissing] = useState<Application | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [dismissBusy, setDismissBusy] = useState(false);
  const [dismissError, setDismissError] = useState("");

  const alertDays = account?.farm.settings.reapplyAlertDays ?? 7;
  const periodText = period
    ? t("sanitary.kpi.periodRange", { from: formatDate(period.from), to: formatDate(period.to) })
    : t("period.allLower");
  const filtersActive = typeFilter !== "ALL" || search !== "" || period !== null;
  const totalPages = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = applications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const relativeDay = (date: string) => {
    const days = daysBetween(date.slice(0, 10), today);
    return days <= 0 ? t("sanitary.today") : t("sanitary.daysAgo", { count: days });
  };

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
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

        {/* Números do período */}
        {summaryError ? (
          <div className="mb-6">
            <LoadError compact message={t("sanitary.summaryLoadFailed")} onRetry={loadSummary} />
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4 mb-6">
            <StatCard
              icon={<Syringe size={22} />}
              tone="health"
              label={t("sanitary.kpi.applications")}
              value={summary ? String(summary.applications) : "—"}
              detail={periodText}
            />
            <StatCard
              icon={<CowIcon size={26} />}
              tone="health"
              label={t("sanitary.kpi.treated")}
              value={summary ? String(summary.animalsTreated) : "—"}
              detail={summary ? t("sanitary.kpi.treatedDetail", { count: summary.activeAnimals }) : undefined}
            />
            <StatCard
              icon={<CalendarClock size={22} />}
              label={t("sanitary.kpi.reminders")}
              value={summary ? String(summary.reminders.open) : "—"}
              tone={summary ? reminderTone(summary.reminders.overdue, summary.reminders.open) : "health"}
              detail={
                summary
                  ? summary.reminders.overdue > 0
                    ? t("sanitary.kpi.remindersOverdue", { count: summary.reminders.overdue })
                    : t("sanitary.kpi.remindersDetail", { count: summary.reminders.alertDays })
                  : undefined
              }
            />
            <StatCard
              icon={<Package size={22} />}
              tone="neutral"
              label={t("sanitary.kpi.products")}
              value={summary ? String(summary.products) : "—"}
              detail={t("sanitary.kpi.productsDetail")}
              to="/produtos"
              linkLabel={t("sanitary.products")}
            />
          </div>
        )}

        {/* Lembretes de reaplicação (D-40): saem só ao reaplicar a partir
            deles, ao dispensar ou sem animal ativo — nunca pelo tempo */}
        {alertsError ? (
          <div className="mb-6">
            <LoadError compact message={t("sanitary.alertsLoadFailed")} onRetry={loadAlerts} />
          </div>
        ) : (
          <SectionCard
            title={t("sanitary.kpi.reminders")}
            icon={
              <IconCircle size="sm" tone={reminderTone(alerts.filter((app) => app.overdue).length, alerts.length)}>
                <Bell size={17} />
              </IconCircle>
            }
            className="mb-6"
          >
            {alerts.length === 0 ? (
              <div className="flex items-center gap-4">
                <CalendarCheck size={40} aria-hidden="true" className="text-[#0E7470] shrink-0" />
                <div>
                  <p className="text-sm text-texto">{t("sanitary.noReminders", { count: alertDays })}</p>
                  <p className="text-sm text-texto-suave">{t("sanitary.noRemindersHelp")}</p>
                </div>
              </div>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
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
                      <StatusBadge tone={app.overdue ? "red" : "amber"}>
                        {app.overdue ? t("sanitary.overdue") : t("sanitary.soon")}
                      </StatusBadge>
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
          </SectionCard>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("sanitary.typeFilterLabel")}>
            {TYPE_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={typeFilter === value}
                onClick={() => update({ type: value })}
                className={`px-4 py-2 rounded-full text-sm border cursor-pointer ${
                  typeFilter === value ? "bg-verde border-verde text-white" : "bg-card border-borda-chip text-texto-suave hover:text-texto"
                }`}
              >
                {t(`sanitary.filter${value}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="sanitary-search" className="text-sm text-texto-suave">
              <span className="block mb-1">{t("sanitary.searchLabel")}</span>
              <span className="relative block">
                <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve pointer-events-none" />
                <input
                  id="sanitary-search"
                  type="search"
                  value={searchInput}
                  maxLength={60}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("sanitary.searchPlaceholder")}
                  className="w-64 max-w-full border border-borda rounded-lg pl-9 pr-3 py-2 bg-card text-texto"
                />
              </span>
            </label>
            <PeriodFilter period={period} today={today} onChange={(value) => update({ period: value })} />
          </div>
        </div>

        {/* Histórico das aplicações */}
        <section className="bg-card border border-borda rounded-xl" aria-label={t("sanitary.historyLabel")}>
          {loading ? (
            <p className="p-6 text-texto-suave" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : loadError ? (
            <div className="p-6">
              <LoadError message={loadError} onRetry={loadApplications} />
            </div>
          ) : applications.length === 0 && filtersActive ? (
            <EmptyState
              icon={<Search size={22} />}
              title={t("sanitary.noMatchFilters")}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setParams(new URLSearchParams(), { replace: true });
                  }}
                  className={buttonClass("secondary")}
                >
                  {t("herd.clearFilters")}
                </button>
              }
            />
          ) : applications.length === 0 ? (
            <EmptyState
              icon={<Syringe size={22} />}
              title={t("sanitary.empty")}
              help={t("sanitary.emptyHelp")}
              action={
                <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("primary")}>
                  <Plus size={18} aria-hidden="true" /> {t("sanitary.newApplication")}
                </button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead className="bg-[#F7F6F2] text-left text-xs text-texto-suave">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.product")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.animals")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.date")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.next")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.by")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("sanitary.col.status")}</th>
                      <th scope="col" className="px-5 py-3 font-medium text-right">{t("sanitary.col.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda">
                    {pageItems.map((app) => (
                      <tr key={app.id} className="hover:bg-[#FAFAF7]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <ProductTypeIcon type={app.product.type} size={18} className="w-10 h-10" />
                            <div className="min-w-0">
                              <p className="font-medium text-texto truncate">{app.product.name}</p>
                              <p className="text-xs text-texto-suave">{t(`product.type.${app.product.type}`)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-texto">{t("common.animalsCount", { count: app._count?.animals ?? 0 })}</td>
                        <td className="px-5 py-3">
                          <p className="text-texto">{formatDate(app.date)}</p>
                          <p className="text-xs text-texto-suave">{relativeDay(app.date)}</p>
                        </td>
                        <td className="px-5 py-3">
                          {app.reapplyDate ? (
                            <p className="text-texto">{formatDate(app.reapplyDate)}</p>
                          ) : (
                            <p className="text-texto-suave">{t("sanitary.notSet")}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 text-texto">
                            <UserRound size={16} aria-hidden="true" className="text-texto-leve" />
                            {app.createdBy?.name ?? t("sanitary.byUnknown")}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge tone="green">{t("sanitary.applied")}</StatusBadge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/aplicacoes/${app.id}`}
                            state={originState}
                            aria-label={t("sanitary.openApplication", { product: app.product.name, date: formatDate(app.date) })}
                            className="inline-flex w-9 h-9 items-center justify-center rounded-lg text-texto-suave hover:bg-bege hover:text-texto"
                          >
                            <ChevronRight size={18} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                summary={t("sanitary.showing", { shown: pageItems.length, total: applications.length, count: applications.length })}
                onPage={setPage}
              />
            </>
          )}
        </section>

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
                invalidateReminderCount();
                loadAlerts();
                loadSummary();
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
