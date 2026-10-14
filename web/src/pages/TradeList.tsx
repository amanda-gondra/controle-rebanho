import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listTrades, type TradeFilters } from "../services/trades.js";
import type { TradePage, TradeType } from "../types/trade.js";
import { formatDate } from "../types/format.js";
import { formatTradeTotal, priceFormLabel, tradeTypeLabel } from "../types/tradeLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Negociações (G5 — F-NEG-06): todas as compras e vendas, mais recentes
// primeiro: data, tipo, nº de animais, total, comprador/vendedor e o selo
// "Aguardando romaneio" quando falta peso de carcaça.

const PAGE_SIZE = 20;

export function TradeList() {
  const navigate = useNavigate();
  const [type, setType] = useState<TradeType | "">("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TradePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [type, pendingOnly, page]);

  const filtered = type !== "" || pendingOnly;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-medium text-texto">{t("tradeList.title")}</h1>
            <p className="text-texto-suave">{t("tradeList.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/negociacoes/nova?tipo=venda"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-verde text-white font-medium"
            >
              <Plus size={18} aria-hidden="true" /> {t("tradeList.newSale")}
            </Link>
            <Link
              to="/negociacoes/nova?tipo=compra"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-borda-chip bg-card text-texto font-medium"
            >
              <Plus size={18} aria-hidden="true" /> {t("tradeList.newPurchase")}
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            aria-label={t("tradeList.filterType")}
            value={type}
            onChange={(e) => {
              setType(e.target.value as TradeType | "");
              setPage(1);
            }}
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
              onChange={(e) => {
                setPendingOnly(e.target.checked);
                setPage(1);
              }}
            />
            {t("tradeList.pendingOnly")}
          </label>
        </div>

        {loading ? (
          <p className="text-texto-suave">{t("common.loading")}</p>
        ) : error ? (
          <p role="alert" className="text-alerta">
            {error}
          </p>
        ) : !data || data.items.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-8 text-center">
            <p className="text-texto mb-3">{t(filtered ? "tradeList.emptyFiltered" : "tradeList.empty")}</p>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setType("");
                  setPendingOnly(false);
                }}
                className="text-verde font-medium cursor-pointer"
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
                  <button
                    type="button"
                    onClick={() => navigate(`/negociacoes/${trade.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bege cursor-pointer"
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
                  </button>
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
