import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listTrades, type TradeFilters } from "../services/trades.js";
import type { TradePage, TradeType } from "../types/trade.js";
import { formatDate } from "../types/format.js";
import { formatTradeTotal, priceFormLabel, tradeTypeLabel } from "../types/tradeLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOriginState } from "../navigation/hooks.js";
import { buildParams, readChoice, readPage } from "../navigation/listParams.js";

// Negociações (G5 — F-NEG-06): todas as compras e vendas, mais recentes
// primeiro: data, tipo, nº de animais, total, comprador/vendedor e o selo
// "Aguardando romaneio" quando falta peso de carcaça.

const PAGE_SIZE = 20;
const TYPE_VALUES = ["", "SALE", "PURCHASE"] as const;
const DEFAULTS = { type: "", pending: "", page: 1 };

export function TradeList() {
  const originState = useOriginState();
  // Filtros e página no endereço: abrir uma negociação e voltar mantém a lista
  const [params, setParams] = useSearchParams();
  const type: TradeType | "" = readChoice(params, "type", TYPE_VALUES, "");
  const pendingOnly = params.get("pending") === "1";
  const page = readPage(params);
  const update = (changes: Partial<{ type: string; pending: string; page: number }>) =>
    setParams(buildParams({ type, pending: pendingOnly ? "1" : "", page: 1, ...changes }, DEFAULTS), { replace: true });
  const setPage = (value: number) => update({ page: value });
  const [data, setData] = useState<TradePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    const filters: TradeFilters = { page, pageSize: PAGE_SIZE };
    if (type) filters.type = type;
    if (pendingOnly) filters.pending = true;
    let cancelled = false;
    listTrades(filters)
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
  }, [type, pendingOnly, page, attempt]);

  const filtered = type !== "" || pendingOnly;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  // Endereço com página que não existe mais (ex.: link antigo): vai para a última
  const outOfRange = !!data && data.items.length === 0 && data.total > 0 && page > pages;
  useEffect(() => {
    if (outOfRange) setParams(buildParams({ type, pending: pendingOnly ? "1" : "", page: pages }, DEFAULTS), { replace: true });
  }, [outOfRange, pages, type, pendingOnly, setParams]);

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

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            aria-label={t("tradeList.filterType")}
            value={type}
            onChange={(e) => update({ type: e.target.value })}
            className="bg-card border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
          >
            <option value="">{t("tradeList.allTypes")}</option>
            <option value="SALE">{t("tradeList.sales")}</option>
            <option value="PURCHASE">{t("tradeList.purchases")}</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-texto cursor-pointer">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => update({ pending: e.target.checked ? "1" : "" })}
            />
            {t("tradeList.pendingOnly")}
          </label>
        </div>

        {loading ? (
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        ) : error ? (
          <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !data || data.items.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-8 text-center">
            <p className="text-texto mb-3">{t(filtered ? "tradeList.emptyFiltered" : "tradeList.empty")}</p>
            {filtered && (
              <button
                type="button"
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className={buttonClass("secondary")}
              >
                {t("tradeList.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="bg-card border border-borda rounded-xl divide-y divide-borda">
              {data.items.map((trade) => (
                <li key={trade.id}>
                  <Link
                    to={`/negociacoes/${trade.id}`}
                    state={originState}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bege"
                  >
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                        trade.type === "SALE" ? "bg-verde-claro text-verde-escuro" : "bg-[#F1EFE8] text-couro"
                      }`}
                    >
                      {tradeTypeLabel(trade.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-texto font-medium">
                        {formatDate(trade.date)} · {t("common.animalsCount", { count: trade.animalCount })}
                      </span>
                      <span className="block text-xs text-texto-suave truncate">
                        {[priceFormLabel(trade.priceUnit, trade.arrobaBasis), trade.counterparty]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex flex-col items-end shrink-0">
                      <span className="text-texto font-medium">
                        {formatTradeTotal(trade)}
                      </span>
                      {trade.pending && (
                        <span className="text-xs rounded px-1.5 py-0.5 bg-[#FAEEDA] text-[#854F0B]">
                          {t("trade.awaitingCarcassBadge")}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} className="text-texto-leve shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4 text-sm">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-borda-chip bg-card cursor-pointer disabled:opacity-50"
                >
                  {t("trade.previous")}
                </button>
                <span className="text-texto-suave">{t("tradeList.pageOf", { page, pages })}</span>
                <button
                  type="button"
                  disabled={page === pages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-borda-chip bg-card cursor-pointer disabled:opacity-50"
                >
                  {t("trade.next")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
