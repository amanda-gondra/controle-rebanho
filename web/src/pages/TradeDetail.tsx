import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Scale, Trash2, Undo2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { useToast } from "../components/ToastProvider.js";
import { deleteTrade, getTrade, removeTradeItem } from "../services/trades.js";
import type { Trade, TradeItem } from "../types/trade.js";
import { formatDate, formatNumber } from "../types/format.js";
import { formatTradeMoney, formatTradeTotal, formatUnitPrice, priceUnitLabel, tradeTypeLabel } from "../types/tradeLabels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin, useOriginState } from "../navigation/hooks.js";

// Detalhe de uma negociação (G5 — F-NEG-04/05): os animais com peso, preço e
// valor; corrigir; informar o peso de carcaça que chegou depois; tirar um
// animal; desfazer tudo. Toda conta mostrada aqui veio do servidor.

const kg = (value: string | null) =>
  value === null ? "—" : t("units.kgValue", { value: formatNumber(Number(value)) });

export function TradeDetail() {
  const { id } = useParams();
  const { goBack } = useOrigin("/negociacoes");
  const originState = useOriginState();
  const showToast = useToast();
  const { labelOf } = useCategoryLabels();

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loadError, setLoadError] = useState<"notFound" | string | null>(null);
  const [removing, setRemoving] = useState<TradeItem | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    getTrade(id)
      .then((data) => {
        setTrade(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(err?.status === 404 ? "notFound" : errorMessage(err, "trade.loadFailed")));
  }, [id]);

  useEffect(load, [load]);

  async function confirmRemove() {
    if (!trade || !removing) return;
    setBusy(true);
    setActionError("");
    try {
      const { tradeDeleted } = await removeTradeItem(trade.id, removing.id);
      showToast(t("tradeDetail.animalRemoved", { tag: removing.animal.tag }));
      setRemoving(null);
      if (tradeDeleted) goBack();
      else load();
    } catch (err) {
      setActionError(errorMessage(err, "trade.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmUndo() {
    if (!trade) return;
    setBusy(true);
    setActionError("");
    try {
      await deleteTrade(trade.id);
      showToast(t(trade.type === "SALE" ? "tradeDetail.saleUndone" : "tradeDetail.purchaseUndone"));
      goBack();
    } catch (err) {
      setActionError(errorMessage(err, "trade.saveFailed"));
      setBusy(false);
    }
  }

  if (loadError === "notFound") {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <div className="bg-card border border-borda rounded-xl p-8 text-center max-w-lg">
            <p className="text-texto font-medium mb-3">{t("tradeDetail.notFound")}</p>
            <Link to="/negociacoes" className={buttonClass("primary")}>
              {t("tradeDetail.backToList")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isSale = trade?.type === "SALE";
  const carcassBasis = trade?.priceUnit === "PER_ARROBA" && trade.arrobaBasis === "CARCASS";
  const unitText = trade ? priceUnitLabel(trade.priceUnit, trade.arrobaBasis, trade.arrobaFactorKg) : "";

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        {!trade ? (
          loadError ? (
            <>
              <PageHeader title={t("tradeList.title")} backFallback="/negociacoes" backLabel={t("tradeDetail.backToList")} />
              <LoadError message={loadError} onRetry={load} />
            </>
          ) : (
            <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
          )
        ) : (
          <div className="max-w-4xl">
            {/* Cabeçalho */}
            <PageHeader
              title={t("tradeDetail.title", { type: tradeTypeLabel(trade.type), date: formatDate(trade.date) })}
              subtitle={[
                t("common.animalsCount", { count: trade.animalCount }),
                unitText,
                trade.counterparty &&
                  t(isSale ? "tradeDetail.buyer" : "tradeDetail.seller", { name: trade.counterparty }),
              ]
                .filter(Boolean)
                .join(" · ")}
              backFallback="/negociacoes"
              backLabel={t("tradeDetail.backToList")}
              actions={
                <>
                  <Link
                    to={`/negociacoes/${trade.id}/editar`}
                    state={originState}
                    className={buttonClass("secondary", "text-sm px-3 py-2")}
                  >
                    <Pencil size={16} aria-hidden="true" /> {t("tradeDetail.edit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setUndoing(true)}
                    className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
                  >
                    <Undo2 size={16} aria-hidden="true" /> {t(isSale ? "tradeDetail.undoSale" : "tradeDetail.undoPurchase")}
                  </button>
                </>
              }
            >
              {trade.notes && <p className="text-sm text-texto-leve mt-1 whitespace-pre-line">{trade.notes}</p>}
              {trade.withdrawalWarningAccepted && (
                <p className="text-sm text-texto-suave mt-1">{t("trade.withdrawalAccepted")}</p>
              )}
            </PageHeader>

            {/* Total */}
            <div className="bg-card border border-borda rounded-xl p-4 md:p-6 mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-texto-suave">{t("tradeDetail.total")}</p>
                <p className="text-2xl font-medium text-texto">
                  {formatTradeTotal(trade)}
                </p>
                {trade.pending && (
                  <p className="text-xs text-texto-suave mt-1">{t("tradeDetail.knownTotalHelp")}</p>
                )}
              </div>
              {trade.pending && (
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <span className="text-xs rounded px-2 py-1 bg-[#FAEEDA] text-[#854F0B]">
                    {t("trade.awaitingCarcassBadge")}
                  </span>
                  <Link
                    to={`/negociacoes/${trade.id}/editar`}
                    state={originState}
                    className={buttonClass("primary", "text-sm px-3 py-2")}
                  >
                    <Scale size={16} aria-hidden="true" /> {t("tradeDetail.informCarcass")}
                  </Link>
                </div>
              )}
            </div>

            {/* Animais */}
            <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
              <h2 className="font-medium text-texto mb-3">{t("trade.animalsTitle")}</h2>
              <ul className="flex flex-col divide-y divide-borda">
                {trade.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/animais/${item.animal.id}`} state={originState} className="font-medium text-texto hover:text-verde">
                        {item.animal.tag}
                      </Link>
                      <span className="text-sm text-texto-suave">
                        {" · "}
                        {[labelOf(item.animal.category, item.animal.sex), item.animal.breed].filter(Boolean).join(" · ")}
                      </span>
                      <p className="text-xs text-texto-suave">
                        {[
                          item.liveWeightKg !== null && t("tradeDetail.liveWeight", { weight: kg(item.liveWeightKg) }),
                          carcassBasis &&
                            (item.carcassWeightKg !== null
                              ? t("tradeDetail.carcassWeight", { weight: kg(item.carcassWeightKg) })
                              : t("tradeDetail.carcassMissing")),
                          formatUnitPrice(trade.priceUnit, item.unitPrice),
                          item.priceAdjusted && t("trade.adjusted"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="font-medium text-texto whitespace-nowrap">{formatTradeMoney(item.value)}</span>
                    <button
                      type="button"
                      onClick={() => setRemoving(item)}
                      title={t("tradeDetail.removeAnimal", { tag: item.animal.tag })}
                      aria-label={t("tradeDetail.removeAnimal", { tag: item.animal.tag })}
                      className="text-texto-leve hover:text-alerta cursor-pointer p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-texto-leve mt-3">{t("tradeDetail.noCosts")}</p>
            </section>
          </div>
        )}

        {trade && removing && (
          <ConfirmDialog
            title={t("tradeDetail.removeTitle", { tag: removing.animal.tag })}
            confirmLabel={t("tradeDetail.removeConfirm")}
            busyLabel={t("common.saving")}
            busy={busy}
            danger
            error={actionError}
            onConfirm={confirmRemove}
            onClose={() => {
              setRemoving(null);
              setActionError("");
            }}
          >
            <p>{t(isSale ? "tradeDetail.removeSaleBody" : "tradeDetail.removePurchaseBody")}</p>
            {trade.animalCount === 1 && <p>{t("tradeDetail.removeLastBody")}</p>}
          </ConfirmDialog>
        )}

        {trade && undoing && (
          <ConfirmDialog
            title={t(isSale ? "tradeDetail.undoSaleTitle" : "tradeDetail.undoPurchaseTitle", {
              count: trade.animalCount,
            })}
            confirmLabel={t(isSale ? "tradeDetail.undoSale" : "tradeDetail.undoPurchase")}
            busyLabel={t("common.saving")}
            busy={busy}
            danger
            error={actionError}
            onConfirm={confirmUndo}
            onClose={() => {
              setUndoing(false);
              setActionError("");
            }}
          >
            <p>
              {t(isSale ? "tradeDetail.undoSaleBody" : "tradeDetail.undoPurchaseBody", { count: trade.animalCount })}
            </p>
          </ConfirmDialog>
        )}
      </main>
    </div>
  );
}
