import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Clock, Handshake, Plus, Search, ShoppingCart, Tag, UserRound } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getTradesOverview, listTrades, type TradeFilters } from "../services/trades.js";
import type { TradePage, TradeType, TradesOverview } from "../types/trade.js";
import { formatDate, formatMoney, todayInTimeZone } from "../types/format.js";
import { formatTradeTotal, priceFormLabel, tradeTypeLabel } from "../types/tradeLabels.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { useAuth } from "../components/AuthProvider.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice, readPage, readText } from "../navigation/listParams.js";
import { StatCard } from "../components/ui/StatCard.js";
import { StatusBadge } from "../components/ui/StatusBadge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Pagination } from "../components/ui/Pagination.js";
import { PeriodFilter, type Period } from "../components/ui/PeriodFilter.js";

// Negociações (G5 — F-NEG-06): números do período, abas Todas/Compras/Vendas,
// busca, período e situação; tabela com tipo, animal (ou quantos), quem
// comprou/vendeu, data, forma de preço, valor e situação ("Aguardando
// romaneio" quando falta peso de carcaça). Tudo no endereço.

const PAGE_SIZE = 20;
const TYPE_VALUES = ["", "SALE", "PURCHASE"] as const;
const STATUS_VALUES = ["", "done", "pending"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULTS = { type: "", status: "", q: "", from: "", to: "", page: 1 };

type Changes = Partial<{ type: string; status: string; q: string; from: string; to: string; page: number }>;

export function TradeList() {
  const originState = useOriginState();
  const { account } = useAuth();
  const { labelOf } = useCategoryLabels();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  const [params, setParams] = useSearchParams();
  const type: TradeType | "" = readChoice(params, "type", TYPE_VALUES, "");
  // "pending=1" é o endereço antigo de "só aguardando romaneio"
  const status = params.get("pending") === "1" ? "pending" : readChoice(params, "status", STATUS_VALUES, "");
  const search = readText(params, "q", 60);
  const fromParam = params.get("from") ?? "";
  const toParam = params.get("to") ?? "";
  const validPeriod = ISO_DATE.test(fromParam) && ISO_DATE.test(toParam) && fromParam <= toParam;
  const from = validPeriod ? fromParam : "";
  const to = validPeriod ? toParam : "";
  const period: Period = validPeriod ? { from, to } : null;
  const page = readPage(params);

  const update = useCallback(
    (changes: Changes) =>
      setParams(buildParams({ type, status, q: search, from, to, page: 1, ...changes }, DEFAULTS), { replace: true }),
    [type, status, search, from, to, setParams],
  );

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => update({ q: searchInput.trim() }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);

  const filters: Omit<TradeFilters, "page" | "pageSize"> = {
    ...(type ? { type } : {}),
    ...(status ? { pending: status === "pending" } : {}),
    ...(search ? { q: search } : {}),
    ...(period ? period : {}),
  };
  const filtersKey = JSON.stringify(filters);

  const [data, setData] = useState<TradePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    listTrades({ ...(JSON.parse(filtersKey) as TradeFilters), page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "trade.loadFailed")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filtersKey, page, attempt]);

  // Os números do topo seguem o período e a busca (não a aba nem a situação,
  // para comparar compras e vendas lado a lado)
  const overviewKey = JSON.stringify({ ...(search ? { q: search } : {}), ...(period ? period : {}) });
  const [overview, setOverview] = useState<TradesOverview | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [overviewAttempt, setOverviewAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setOverviewError(false);
    getTradesOverview(JSON.parse(overviewKey))
      .then((result) => !cancelled && setOverview(result))
      .catch(() => !cancelled && setOverviewError(true));
    return () => {
      cancelled = true;
    };
  }, [overviewKey, overviewAttempt]);

  const filtered = type !== "" || status !== "" || search !== "" || period !== null;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Endereço com página que não existe mais (ex.: link antigo): vai para a última
  const outOfRange = !!data && data.items.length === 0 && data.total > 0 && page > pages;
  useEffect(() => {
    if (outOfRange) update({ page: pages });
  }, [outOfRange, pages, update]);

  const periodText = period
    ? t("sanitary.kpi.periodRange", { from: formatDate(period.from), to: formatDate(period.to) })
    : t("period.allLower");
  const sideDetail = (side: { count: number; animals: number }, kind: "sales" | "purchases") =>
    t(`tradeList.kpi.${kind}Detail`, { count: side.count, animals: t("common.animalsCount", { count: side.animals }) });

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("tradeList.title")}
          subtitle={t("tradeList.subtitle")}
          actions={
            <>
              <Link to="/negociacoes/nova?tipo=venda" state={originState} className={buttonClass("primary")}>
                <Plus size={18} aria-hidden="true" /> {t("tradeList.newSale")}
              </Link>
              <Link to="/negociacoes/nova?tipo=compra" state={originState} className={buttonClass("secondary")}>
                <Plus size={18} aria-hidden="true" /> {t("tradeList.newPurchase")}
              </Link>
            </>
          }
        />

        {/* Números do período */}
        {overviewError ? (
          <div className="mb-6">
            <LoadError compact message={t("tradeList.kpi.loadFailed")} onRetry={() => setOverviewAttempt((n) => n + 1)} />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4 mb-2">
              <StatCard
                icon={<Handshake size={22} />}
                tone="neutral"
                label={t("tradeList.kpi.count")}
                value={overview ? String(overview.count) : "—"}
                detail={periodText}
              />
              <StatCard
                icon={<Tag size={22} />}
                tone="sale"
                label={t("tradeList.kpi.sales")}
                value={overview ? formatMoney(Number(overview.sales.total)) : "—"}
                detail={overview ? sideDetail(overview.sales, "sales") : undefined}
              />
              <StatCard
                icon={<ShoppingCart size={22} />}
                tone="purchase"
                label={t("tradeList.kpi.purchases")}
                value={overview ? formatMoney(Number(overview.purchases.total)) : "—"}
                detail={overview ? sideDetail(overview.purchases, "purchases") : undefined}
              />
              <StatCard
                icon={<Clock size={22} />}
                label={t("tradeList.kpi.pending")}
                value={overview ? String(overview.pending) : "—"}
                tone={overview && overview.pending > 0 ? "warning" : "neutral"}
                detail={t("tradeList.kpi.pendingDetail")}
              />
            </div>
            <p className="text-xs text-texto-suave mb-6">
              {t("tradeList.kpi.rule")}
              {overview && overview.otherCurrency > 0 && ` ${t("tradeList.kpi.otherCurrency", { count: overview.otherCurrency })}`}
            </p>
          </>
        )}

        <section className="bg-card border border-borda rounded-xl" aria-label={t("tradeList.title")}>
          {/* Abas e filtros */}
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-4 pb-4 border-b border-borda">
            <div className="flex gap-1" role="group" aria-label={t("tradeList.filterType")}>
              {TYPE_VALUES.map((value) => (
                <button
                  key={value || "all"}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => update({ type: value })}
                  className={`px-3 py-2 text-sm font-medium border-b-2 cursor-pointer ${
                    type === value ? "border-verde text-verde-escuro" : "border-transparent text-texto-suave hover:text-texto"
                  }`}
                >
                  {t(`tradeList.tab.${value || "ALL"}`)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label htmlFor="trade-search" className="text-sm text-texto-suave">
                <span className="block mb-1">{t("sanitary.searchLabel")}</span>
                <span className="relative block">
                  <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-leve pointer-events-none" />
                  <input
                    id="trade-search"
                    type="search"
                    value={searchInput}
                    maxLength={60}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("tradeList.searchPlaceholder")}
                    className="w-60 max-w-full border border-borda rounded-lg pl-9 pr-3 py-2 bg-card text-texto"
                  />
                </span>
              </label>
              <PeriodFilter
                period={period}
                today={today}
                onChange={(value) => update({ from: value?.from ?? "", to: value?.to ?? "" })}
              />
              <label htmlFor="trade-status" className="text-sm text-texto-suave">
                <span className="block mb-1">{t("tradeList.statusLabel")}</span>
                <select
                  id="trade-status"
                  value={status}
                  onChange={(e) => update({ status: e.target.value })}
                  className="border border-borda rounded-lg px-3 py-2 bg-card text-texto cursor-pointer"
                >
                  <option value="">{t("tradeList.status.all")}</option>
                  <option value="done">{t("tradeList.status.done")}</option>
                  <option value="pending">{t("trade.awaitingCarcassBadge")}</option>
                </select>
              </label>
            </div>
          </div>

          {loading && !data ? (
            <p className="p-6 text-texto-suave" aria-busy="true">
              {t("common.loading")}
            </p>
          ) : error ? (
            <div className="p-6">
              <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />
            </div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              icon={<Handshake size={22} />}
              title={t(filtered ? "tradeList.emptyFiltered" : "tradeList.empty")}
              action={
                filtered ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setParams(new URLSearchParams(), { replace: true });
                    }}
                    className={buttonClass("secondary")}
                  >
                    {t("tradeList.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto" aria-busy={loading}>
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-[#F7F6F2] text-left text-xs text-texto-suave">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.type")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.animal")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.counterparty")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.date")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.value")}</th>
                      <th scope="col" className="px-5 py-3 font-medium">{t("tradeList.col.status")}</th>
                      <th scope="col" className="px-5 py-3 font-medium text-right">{t("tradeList.col.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda">
                    {data.items.map((trade) => (
                      <tr key={trade.id} className="hover:bg-[#FAFAF7]">
                        <td className="px-5 py-3">
                          <StatusBadge tone={trade.type === "SALE" ? "green" : "blue"} dot={false}>
                            {trade.type === "SALE" ? <Tag size={13} aria-hidden="true" /> : <ShoppingCart size={13} aria-hidden="true" />}
                            {tradeTypeLabel(trade.type)}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-3">
                          {trade.animal ? (
                            <>
                              <p className="font-medium text-texto">{trade.animal.tag}</p>
                              <p className="text-xs text-texto-suave whitespace-nowrap">
                                {[sexLabel[trade.animal.sex], labelOf(trade.animal.category, trade.animal.sex), trade.animal.breed]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium text-texto whitespace-nowrap">{t("common.animalsCount", { count: trade.animalCount })}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 text-texto whitespace-nowrap">
                            <UserRound size={16} aria-hidden="true" className="text-texto-leve shrink-0" />
                            {trade.counterparty ?? <span className="text-texto-suave">{t("tradeList.noCounterparty")}</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-texto whitespace-nowrap">{formatDate(trade.date)}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-texto whitespace-nowrap">{formatTradeTotal(trade)}</p>
                          <p className="text-xs text-texto-suave">{priceFormLabel(trade.priceUnit, trade.arrobaBasis)}</p>
                        </td>
                        <td className="px-5 py-3">
                          {trade.pending ? (
                            <StatusBadge tone="amber">{t("trade.awaitingCarcassBadge")}</StatusBadge>
                          ) : (
                            <StatusBadge tone="green">{t("tradeList.status.done")}</StatusBadge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/negociacoes/${trade.id}`}
                            state={originState}
                            aria-label={t(trade.type === "SALE" ? "tradeList.openSale" : "tradeList.openPurchase", { date: formatDate(trade.date) })}
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
                page={Math.min(page, pages)}
                totalPages={pages}
                summary={t("tradeList.showing", { shown: data.items.length, total: data.total, count: data.total })}
                onPage={(value) => update({ page: value })}
              />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
