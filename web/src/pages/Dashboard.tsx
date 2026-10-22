import { useCallback, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, CalendarDays, ChevronRight, Layers, LogIn, LogOut, Scale, Syringe, Tag, TrendingUp, Users } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useAuth } from "../components/AuthProvider.js";
import { getDashboard } from "../services/dashboard.js";
import { PERIOD_PRESETS, presetOf, presetPeriod, type Dashboard as DashboardData, type PeriodPreset } from "../types/dashboard.js";
import type { AnimalOrigin } from "../types/animal.js";
import { formatDate, formatNumber, todayInTimeZone } from "../types/format.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { useOpen, useOriginState } from "../navigation/hooks.js";
import { StatCard } from "../components/ui/StatCard.js";
import { SectionCard } from "../components/ui/SectionCard.js";
import { IconCircle } from "../components/ui/IconCircle.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { CowIcon } from "../components/ui/CowIcon.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Painel mínimo (D-50): o rebanho AGORA e o que aconteceu no PERÍODO, só com
// números reais. Cada bloco diz como o número é contado e leva à lista que
// o explica. O período fica no endereço (?from=&to=).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ORIGINS: AnimalOrigin[] = ["PURCHASED", "BORN_ON_FARM", "RECEIVED", "NOT_INFORMED"];

export function Dashboard() {
  const id = useId();
  const open = useOpen();
  const originState = useOriginState();
  const { account } = useAuth();
  const { labelOf } = useCategoryLabels();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const [params, setParams] = useSearchParams();
  const fromParam = params.get("from") ?? "";
  const toParam = params.get("to") ?? "";
  const from = ISO_DATE.test(fromParam) ? fromParam : undefined;
  const to = ISO_DATE.test(toParam) ? toParam : undefined;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    setLoadError("");
    setData(null);
    getDashboard({ from, to })
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err, "dashboard.loadFailed")));
  }, [from, to]);
  useEffect(load, [load]);

  const setPeriod = (period: { from: string; to: string }) => setParams(period, { replace: true });
  const activePreset = data ? presetOf(data.period, data.today) : null;
  const dateInput = "w-full bg-card border border-borda rounded-lg px-3 py-2 text-sm text-texto";

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:px-8 md:py-6">
        <PageHeader
          title={t("dashboard.title")}
          subtitle={t("dashboard.subtitle")}
          actions={
            <>
              {/* No celular, os atalhos ficam no fim da tela (o topo é dos números) */}
              <button type="button" onClick={() => open("/pesagens")} className={buttonClass("primary", "max-sm:hidden")}>
                <Scale size={18} aria-hidden="true" /> {t("weighingSession.action")}
              </button>
              <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("secondary", "max-sm:hidden")}>
                <Syringe size={18} aria-hidden="true" /> {t("sanitary.newApplication")}
              </button>
            </>
          }
        />

        {/* Período */}
        <section aria-labelledby={`${id}-period`} className="mb-6">
          <h2 id={`${id}-period`} className="sr-only">
            {t("dashboard.period")}
          </h2>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
              {PERIOD_PRESETS.map((preset: PeriodPreset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={activePreset === preset}
                  onClick={() => setPeriod(presetPeriod(preset, today))}
                  className={`px-4 py-2 rounded-full text-sm font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                    activePreset === preset ? "bg-verde border-verde text-white" : "bg-card border-borda text-texto hover:border-borda-chip"
                  }`}
                >
                  {t(`dashboard.preset.${preset}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
              <label className="text-xs text-texto-suave sm:w-40">
                <span className="block mb-1">{t("dashboard.from")}</span>
                <input
                  type="date"
                  value={data?.period.from ?? from ?? ""}
                  max={today}
                  onChange={(e) => e.target.value && setPeriod({ from: e.target.value, to: data?.period.to ?? today })}
                  className={dateInput}
                />
              </label>
              <label className="text-xs text-texto-suave sm:w-40">
                <span className="block mb-1">{t("dashboard.to")}</span>
                <input
                  type="date"
                  value={data?.period.to ?? to ?? ""}
                  max={today}
                  onChange={(e) => e.target.value && setPeriod({ from: data?.period.from ?? e.target.value, to: e.target.value })}
                  className={dateInput}
                />
              </label>
            </div>
          </div>
        </section>

        {loadError ? (
          <LoadError message={loadError} onRetry={load} />
        ) : !data ? (
          <p className="text-texto-suave" aria-busy="true">
            {t("common.loading")}
          </p>
        ) : (
          <>
            {data.herd.active === 0 && data.movements.entriesTotal === 0 && data.movements.sold + data.movements.died === 0 && (
              <div className="bg-card border border-borda rounded-xl p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IconCircle>
                    <CowIcon size={22} />
                  </IconCircle>
                  <div>
                    <p className="font-medium text-texto">{t("dashboard.emptyTitle")}</p>
                    <p className="text-sm text-texto-suave">{t("dashboard.emptyHelp")}</p>
                  </div>
                </div>
                <button type="button" onClick={() => open("/animais/novo")} className={buttonClass("primary")}>
                  {t("herd.addAnimal")}
                </button>
              </div>
            )}

            {/* Números principais */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">
              <StatCard
                icon={<CowIcon size={22} />}
                label={t("dashboard.activeNow")}
                value={formatNumber(data.herd.active)}
                rule={t("dashboard.activeRule")}
                to="/?status=ACTIVE"
                linkLabel={t("dashboard.seeHerd")}
                showLink
              />
              <StatCard
                icon={<LogIn size={20} />}
                label={t("dashboard.entries")}
                value={formatNumber(data.movements.entriesTotal)}
                detail={
                  ORIGINS.filter((origin) => data.movements.entries[origin])
                    .map((origin) => `${t(`animal.origin.${origin}`)}: ${data.movements.entries[origin]}`)
                    .join(" · ") || undefined
                }
                rule={t("dashboard.entriesRule")}
              />
              <StatCard
                icon={<LogOut size={20} />}
                label={t("dashboard.exits")}
                value={formatNumber(data.movements.sold + data.movements.died)}
                detail={t("dashboard.exitsDetail", { sold: data.movements.sold, died: data.movements.died })}
                rule={t("dashboard.exitsRule")}
              />
              <StatCard
                icon={<Bell size={20} />}
                label={t("dashboard.reminders")}
                value={formatNumber(data.reminders.overdue + data.reminders.upcoming)}
                detail={t("dashboard.remindersDetail", { overdue: data.reminders.overdue, upcoming: data.reminders.upcoming })}
                rule={t("dashboard.remindersRule", { days: data.reminders.alertDays })}
                tone={data.reminders.overdue > 0 ? "attention" : "normal"}
                to="/manejo"
                linkLabel={t("dashboard.seeReminders")}
                showLink
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              {/* Por categoria */}
              <SectionCard
                title={t("dashboard.byCategory")}
                subtitle={t("dashboard.byCategoryRule")}
                icon={
                  <IconCircle size="sm">
                    <Tag size={17} />
                  </IconCircle>
                }
              >
                {data.herd.byCategory.length === 0 ? (
                  <EmptyState
                    icon={<CowIcon size={24} />}
                    title={t("dashboard.noActive")}
                    action={
                      <Link to="/" state={originState} className="inline-flex items-center gap-1 text-sm text-verde font-medium hover:underline">
                        {t("dashboard.seeHerd")} <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    }
                  />
                ) : (
                  <BarList
                    items={data.herd.byCategory.map((item) => ({
                      key: `${item.category}-${item.sex}`,
                      label: labelOf(item.category, item.sex),
                      count: item.count,
                      to: `/?status=ACTIVE&category=${item.category}`,
                    }))}
                    total={data.herd.active}
                    originState={originState}
                  />
                )}
              </SectionCard>

              {/* Por lote */}
              <SectionCard
                title={t("dashboard.byLot")}
                subtitle={t("dashboard.byLotRule")}
                icon={
                  <IconCircle size="sm">
                    <Users size={17} />
                  </IconCircle>
                }
                action={
                  <Link to="/lotes" state={originState} className="inline-flex items-center gap-1 text-sm text-verde font-medium hover:underline shrink-0">
                    {t("dashboard.seeLots")} <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                }
              >
                {data.herd.active === 0 ? (
                  <EmptyState icon={<Layers size={24} />} title={t("dashboard.noActive")} />
                ) : (
                  <BarList
                    items={[
                      ...data.herd.byLot.map((item) => ({
                        key: item.lotId,
                        label: item.name,
                        count: item.count,
                        to: `/lotes/${item.lotId}`,
                      })),
                      ...(data.herd.withoutLot > 0
                        ? [{ key: "none", label: t("herd.noLot"), count: data.herd.withoutLot, to: "/?status=ACTIVE&lot=none" }]
                        : []),
                    ]}
                    total={data.herd.active}
                    originState={originState}
                  />
                )}
              </SectionCard>
            </div>

            {/* Pesagens e GMD */}
            <SectionCard
              title={t("dashboard.weighings")}
              subtitle={t("dashboard.weighingsRule")}
              icon={
                <IconCircle size="sm">
                  <Scale size={17} />
                </IconCircle>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr] gap-4 items-start">
                <MiniStat
                  icon={<CalendarDays size={16} />}
                  label={t("dashboard.weighingsInPeriod")}
                  value={formatNumber(data.weighings.inPeriod)}
                  detail={t("dashboard.animalsWeighed", { count: data.weighings.animalsWeighed })}
                />
                <MiniStat
                  icon={<TrendingUp size={16} />}
                  label={t("dashboard.averageGain")}
                  value={
                    data.gain.averageDailyGainKg === null
                      ? "—"
                      : t("units.kgPerDay", { value: formatNumber(data.gain.averageDailyGainKg, { maximumFractionDigits: 3 }) })
                  }
                  detail={
                    data.gain.averageDailyGainKg === null
                      ? t("dashboard.noGain")
                      : t("dashboard.gainBase", { count: data.gain.animalsWithGain, without: data.gain.animalsWithoutGain })
                  }
                />
                <div className="border border-borda rounded-xl p-4 md:col-span-2 xl:col-span-1">
                  <h3 className="text-sm font-medium text-texto mb-2">{t("dashboard.recentWeighings")}</h3>
                  {data.weighings.recent.length === 0 ? (
                    <p className="text-sm text-texto-suave">{t("animalDetail.noWeighings")}</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-texto-suave">
                          <th scope="col" className="font-medium pb-1">{t("dashboard.colAnimal")}</th>
                          <th scope="col" className="font-medium pb-1">{t("dashboard.colWeight")}</th>
                          <th scope="col" className="font-medium pb-1">{t("dashboard.colDate")}</th>
                          <th scope="col" className="sr-only">{t("common.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borda">
                        {data.weighings.recent.map((weighing) => (
                          <tr key={weighing.id} className="hover:bg-bege">
                            <td className="py-2 font-medium text-texto">{weighing.animal.tag}</td>
                            <td className="py-2 text-texto">{t("units.kgValue", { value: formatNumber(Number(weighing.weightKg)) })}</td>
                            <td className="py-2 text-texto-suave">{formatDate(weighing.date)}</td>
                            <td className="py-2 text-right">
                              <Link
                                to={`/animais/${weighing.animal.id}`}
                                state={originState}
                                aria-label={t("dashboard.openAnimal", { tag: weighing.animal.tag })}
                                className="inline-flex p-1 rounded text-texto-leve hover:text-verde"
                              >
                                <ChevronRight size={16} aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <p className="text-xs text-texto-leve mt-3">{t("dashboard.gainRule")}</p>
            </SectionCard>

            <div className="flex flex-col gap-2 mt-6 sm:hidden">
              <button type="button" onClick={() => open("/pesagens")} className={buttonClass("primary")}>
                <Scale size={18} aria-hidden="true" /> {t("weighingSession.action")}
              </button>
              <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("secondary")}>
                <Syringe size={18} aria-hidden="true" /> {t("sanitary.newApplication")}
              </button>
            </div>

            <p className="text-xs text-texto-leve mt-6">
              {t("dashboard.periodLine", { from: formatDate(data.period.from), to: formatDate(data.period.to) })}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function MiniStat(props: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="border border-borda rounded-xl p-4">
      <p className="flex items-center gap-2 text-sm text-texto-suave">
        <IconCircle size="sm">{props.icon}</IconCircle>
        {props.label}
      </p>
      <p className="text-2xl font-semibold text-texto mt-2">{props.value}</p>
      <p className="text-xs text-texto-suave mt-1">{props.detail}</p>
    </div>
  );
}

// Barras simples: o número sempre escrito (a barra só ajuda a comparar)
function BarList(props: {
  items: { key: string; label: string; count: number; to: string }[];
  total: number;
  originState: { from: string };
}) {
  return (
    <ul className="flex flex-col gap-2">
      {props.items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} state={props.originState} className="block hover:bg-bege -mx-2 px-2 py-1 rounded-lg">
            <span className="flex items-center justify-between text-sm text-texto">
              <span className="truncate">{item.label}</span>
              <span className="font-medium shrink-0 ml-3">
                {formatNumber(item.count)}{" "}
                <span className="text-texto-suave font-normal">
                  ({formatNumber(props.total === 0 ? 0 : item.count / props.total, { style: "percent", maximumFractionDigits: 0 })})
                </span>
              </span>
            </span>
            <span className="block h-2 rounded-full bg-bege mt-1" aria-hidden="true">
              <span
                className="block h-2 rounded-full bg-verde"
                style={{ width: `${props.total === 0 ? 0 : Math.max(2, (item.count / props.total) * 100)}%` }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
