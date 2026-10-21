import { useCallback, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, ChevronRight, LogIn, LogOut, Scale, Syringe } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("dashboard.title")}
          subtitle={t("dashboard.subtitle")}
          actions={
            <>
              <button type="button" onClick={() => open("/pesagens")} className={buttonClass("secondary")}>
                <Scale size={18} aria-hidden="true" /> {t("weighingSession.action")}
              </button>
              <button type="button" onClick={() => open("/aplicacoes/nova")} className={buttonClass("secondary")}>
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
          <div className="flex flex-wrap items-end gap-2">
            {PERIOD_PRESETS.map((preset: PeriodPreset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={activePreset === preset}
                onClick={() => setPeriod(presetPeriod(preset, today))}
                className={`px-3.5 py-1.5 rounded-full text-sm border cursor-pointer ${
                  activePreset === preset ? "bg-verde border-verde text-white" : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {t(`dashboard.preset.${preset}`)}
              </button>
            ))}
            <label className="text-sm text-texto-suave">
              <span className="block">{t("dashboard.from")}</span>
              <input
                type="date"
                value={data?.period.from ?? from ?? ""}
                max={today}
                onChange={(e) => e.target.value && setPeriod({ from: e.target.value, to: data?.period.to ?? today })}
                className="bg-card border border-borda rounded-lg px-2 py-1.5 text-texto"
              />
            </label>
            <label className="text-sm text-texto-suave">
              <span className="block">{t("dashboard.to")}</span>
              <input
                type="date"
                value={data?.period.to ?? to ?? ""}
                max={today}
                onChange={(e) => e.target.value && setPeriod({ from: data?.period.from ?? e.target.value, to: e.target.value })}
                className="bg-card border border-borda rounded-lg px-2 py-1.5 text-texto"
              />
            </label>
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
              <div className="bg-card border border-borda rounded-xl p-6 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-texto">{t("dashboard.emptyTitle")}</p>
                  <p className="text-sm text-texto-suave">{t("dashboard.emptyHelp")}</p>
                </div>
                <button type="button" onClick={() => open("/animais/novo")} className={buttonClass("primary")}>
                  {t("herd.addAnimal")}
                </button>
              </div>
            )}

            {/* Números principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <Tile
                label={t("dashboard.activeNow")}
                value={formatNumber(data.herd.active)}
                rule={t("dashboard.activeRule")}
                to="/?status=ACTIVE"
                linkLabel={t("dashboard.seeHerd")}
              />
              <Tile
                icon={<LogIn size={16} aria-hidden="true" />}
                label={t("dashboard.entries")}
                value={formatNumber(data.movements.entriesTotal)}
                rule={t("dashboard.entriesRule")}
                detail={ORIGINS.filter((origin) => data.movements.entries[origin])
                  .map((origin) => `${t(`animal.origin.${origin}`)}: ${data.movements.entries[origin]}`)
                  .join(" · ")}
              />
              <Tile
                icon={<LogOut size={16} aria-hidden="true" />}
                label={t("dashboard.exits")}
                value={formatNumber(data.movements.sold + data.movements.died)}
                rule={t("dashboard.exitsRule")}
                detail={t("dashboard.exitsDetail", { sold: data.movements.sold, died: data.movements.died })}
              />
              <Tile
                icon={<Bell size={16} aria-hidden="true" />}
                label={t("dashboard.reminders")}
                value={formatNumber(data.reminders.overdue + data.reminders.upcoming)}
                rule={t("dashboard.remindersRule", { days: data.reminders.alertDays })}
                detail={t("dashboard.remindersDetail", { overdue: data.reminders.overdue, upcoming: data.reminders.upcoming })}
                tone={data.reminders.overdue > 0 ? "attention" : "normal"}
                to="/manejo"
                linkLabel={t("dashboard.seeReminders")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por categoria */}
              <Panel title={t("dashboard.byCategory")} rule={t("dashboard.byCategoryRule")}>
                {data.herd.byCategory.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t("dashboard.noActive")}</p>
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
              </Panel>

              {/* Por lote */}
              <Panel
                title={t("dashboard.byLot")}
                rule={t("dashboard.byLotRule")}
                action={
                  <Link to="/lotes" state={originState} className="text-sm text-verde font-medium hover:underline">
                    {t("dashboard.seeLots")}
                  </Link>
                }
              >
                {data.herd.active === 0 ? (
                  <p className="text-sm text-texto-suave">{t("dashboard.noActive")}</p>
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
              </Panel>

              {/* Pesagens e GMD */}
              <Panel title={t("dashboard.weighings")} rule={t("dashboard.weighingsRule")} wide>
                <dl className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <dt className="text-sm text-texto-suave">{t("dashboard.weighingsInPeriod")}</dt>
                    <dd className="text-2xl font-semibold text-texto">{formatNumber(data.weighings.inPeriod)}</dd>
                    <dd className="text-xs text-texto-suave">
                      {t("dashboard.animalsWeighed", { count: data.weighings.animalsWeighed })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-texto-suave">{t("dashboard.averageGain")}</dt>
                    <dd className="text-2xl font-semibold text-texto">
                      {data.gain.averageDailyGainKg === null
                        ? "—"
                        : t("units.kgPerDay", { value: formatNumber(data.gain.averageDailyGainKg, { maximumFractionDigits: 3 }) })}
                    </dd>
                    <dd className="text-xs text-texto-suave">
                      {data.gain.averageDailyGainKg === null
                        ? t("dashboard.noGain")
                        : t("dashboard.gainBase", { count: data.gain.animalsWithGain, without: data.gain.animalsWithoutGain })}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-texto-leve mb-3">{t("dashboard.gainRule")}</p>
                <h3 className="text-sm font-medium text-texto mb-1">{t("dashboard.recentWeighings")}</h3>
                {data.weighings.recent.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t("animalDetail.noWeighings")}</p>
                ) : (
                  <ul className="divide-y divide-borda">
                    {data.weighings.recent.map((weighing) => (
                      <li key={weighing.id}>
                        <Link
                          to={`/animais/${weighing.animal.id}`}
                          state={originState}
                          className="flex items-center gap-3 py-2 hover:bg-bege -mx-2 px-2 rounded-lg text-sm"
                        >
                          <span className="font-medium text-texto w-24 truncate">{weighing.animal.tag}</span>
                          <span className="flex-1 text-texto">{t("units.kgValue", { value: formatNumber(Number(weighing.weightKg)) })}</span>
                          <span className="text-texto-suave">{formatDate(weighing.date)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

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

function Tile(props: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  rule: string;
  detail?: string;
  tone?: "normal" | "attention";
  to?: string;
  linkLabel?: string;
}) {
  const originState = useOriginState();
  return (
    <div className={`bg-card border rounded-xl p-5 flex flex-col ${props.tone === "attention" ? "border-[#E7C3B8]" : "border-borda"}`}>
      <p className="flex items-center gap-1.5 text-sm text-texto-suave">
        {props.icon}
        {props.label}
      </p>
      <p className="text-3xl font-semibold text-texto mt-1">{props.value}</p>
      {props.detail && <p className="text-sm text-texto mt-1">{props.detail}</p>}
      <p className="text-xs text-texto-leve mt-2 flex-1">{props.rule}</p>
      {props.to && (
        <Link to={props.to} state={originState} className="mt-3 inline-flex items-center gap-1 text-sm text-verde font-medium hover:underline">
          {props.linkLabel}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Panel(props: { title: string; rule?: string; action?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`bg-card border border-borda rounded-xl p-5 ${props.wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 id={id} className="font-medium text-texto">
          {props.title}
        </h2>
        {props.action}
      </div>
      {props.rule && <p className="text-xs text-texto-leve mb-3">{props.rule}</p>}
      {props.children}
    </section>
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
