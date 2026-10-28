import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { TradeDealFields, type DealDraft } from "../components/TradeDealFields.js";
import { TradePricesEditor } from "../components/TradePricesEditor.js";
import { getLastPrices, getTrade, updateTrade } from "../services/trades.js";
import type { LastPrices, Trade } from "../types/trade.js";
import type { DraftRow, GroupBy } from "../types/tradeMath.js";
import { checkDeal, checkRows, splitApiErrors, startEdit } from "../types/tradeForm.js";
import { formatDate, todayInTimeZone } from "../types/format.js";
import { tradeTypeLabel } from "../types/tradeLabels.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin } from "../navigation/hooks.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";

// Corrigir uma negociação (G5 — F-NEG-04/05): data, forma de preço, preços,
// pesos, comprador/vendedor, observações — e o peso de carcaça que chegou
// depois do abate (D-35). Mesma tela de preços da criação; o servidor
// recalcula todos os valores ao salvar.

export function TradeEdit() {
  const { id } = useParams();
  // Sem origem (link direto): voltar/cancelar/salvar levam ao detalhe
  const { goBack } = useOrigin(`/negociacoes/${id}`);
  const showToast = useToast();
  const { account } = useAuth();
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");
  const farmFactor = account?.farm.settings.arrobaLiveFactorKg ?? 30;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deal, setDeal] = useState<DealDraft | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");
  const [groupPrices, setGroupPrices] = useState<Record<string, string>>({});
  const [lastPrices, setLastPrices] = useState<LastPrices | null>(null);
  const [dealErrors, setDealErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [showProblems, setShowProblems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Alterações não salvas: o formulário comparado com o que veio do servidor
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const snapshot = JSON.stringify([deal, rows, groupBy, groupPrices]);
  const dirty = initialSnapshot !== null && snapshot !== initialSnapshot;
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges(dirty && !saving);

  const load = useCallback(() => {
    if (!id) return;
    setLoadError("");
    getTrade(id)
      .then((data) => {
        const start = startEdit(data, farmFactor);
        setInitialSnapshot(JSON.stringify([start.deal, start.rows, start.groupBy, start.groupPrices]));
        setTrade(data);
        setDeal(start.deal);
        setRows(start.rows);
        setGroupBy(start.groupBy);
        setGroupPrices(start.groupPrices);
      })
      .catch((err) => {
        setNotFound(err?.status === 404);
        setLoadError(err?.status === 404 ? t("tradeDetail.notFound") : errorMessage(err, "trade.loadFailed"));
      });
  }, [id, farmFactor]);

  useEffect(load, [load]);

  const type = trade?.type ?? "SALE";
  const priceUnit = deal?.priceUnit ?? "PER_KG";
  const arrobaBasis = deal?.priceUnit === "PER_ARROBA" ? deal.arrobaBasis : null;
  useEffect(() => {
    if (!trade || (priceUnit === "PER_ARROBA" && !arrobaBasis)) return;
    getLastPrices(type, priceUnit, arrobaBasis)
      .then(setLastPrices)
      .catch(() => setLastPrices(null));
  }, [trade, type, priceUnit, arrobaBasis]);

  const dealCheck = deal ? checkDeal(deal) : null;

  async function save() {
    if (!trade || !deal || !dealCheck) return;
    setSaveError("");
    setShowProblems(true);
    setDealErrors(dealCheck.errors);
    const pricing = dealCheck.pricing;
    if (!pricing) return;
    const rowsCheck = checkRows(rows, pricing, groupBy, groupPrices);
    if (!rowsCheck.ok) return setSaveError(t("trade.fixRows"));

    setSaving(true);
    try {
      const updated = await updateTrade(trade.id, {
        date: deal.date,
        priceUnit: pricing.priceUnit,
        arrobaBasis: pricing.arrobaBasis,
        arrobaFactorKg: pricing.arrobaFactorKg ? Number(pricing.arrobaFactorKg) : null,
        counterparty: deal.counterparty.trim() || null,
        notes: deal.notes.trim() || null,
        items: rows.map((row, index) => ({ id: row.key, ...rowsCheck.items[index] })),
      });
      const replaced = updated.replacedWeighings ?? 0;
      const message = t("tradeEdit.saved");
      showToast(replaced > 0 ? `${message} ${t("trade.replacedWeighings", { count: replaced })}` : message);
      allowLeave();
      goBack();
    } catch (err) {
      setSaving(false);
      const split = splitApiErrors(err, rows.map((row) => row.key));
      setRowErrors(split.rows);
      setDealErrors(split.deal);
      setSaveError(
        Object.keys(split.rows).length > 0
          ? t("trade.rowsHaveProblems", { count: Object.keys(split.rows).length })
          : errorMessage(err, "trade.saveFailed"),
      );
    }
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        {!trade || !deal ? (
          notFound ? (
            <div className="bg-card border border-borda rounded-xl p-8 text-center max-w-lg">
              <p role="alert" className="text-texto font-medium mb-3">
                {loadError}
              </p>
              <Link to="/negociacoes" className={buttonClass("primary")}>
                {t("tradeDetail.backToList")}
              </Link>
            </div>
          ) : loadError ? (
            <>
              <PageHeader title={t("tradeEdit.title")} backFallback={`/negociacoes/${id}`} />
              <LoadError message={loadError} onRetry={load} />
            </>
          ) : (
            <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
          )
        ) : (
          <div className="max-w-4xl">
            <PageHeader
              title={t("tradeEdit.title")}
              subtitle={t("tradeDetail.title", { type: tradeTypeLabel(trade.type), date: formatDate(trade.date) })}
              backFallback={`/negociacoes/${trade.id}`}
            />

            <section className="bg-card border border-borda rounded-xl p-4 md:p-6 mb-6">
              <TradeDealFields
                type={trade.type}
                value={deal}
                onChange={(patch) => {
                  setDeal({ ...deal, ...patch });
                  setDealErrors({});
                }}
                errors={dealErrors}
                maxDate={today}
              />
            </section>

            {dealCheck?.pricing ? (
              <TradePricesEditor
                type={trade.type}
                pricing={dealCheck.pricing}
                rows={rows}
                onRowsChange={(next) => {
                  setRows(next);
                  setRowErrors({});
                }}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
                groupPrices={groupPrices}
                onGroupPricesChange={setGroupPrices}
                lastPrices={lastPrices}
                rowErrors={rowErrors}
                showProblems={showProblems}
              />
            ) : (
              <p className="text-sm text-texto-suave">{t("tradeEdit.completeDealFirst")}</p>
            )}

            {saveError && (
              <p role="alert" className="text-sm text-alerta mt-4">
                {saveError}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={goBack} className={buttonClass("secondary")}>
                {t("common.cancel")}
              </button>
              <button type="button" onClick={save} disabled={saving} className={buttonClass("primary")}>
                {saving ? t("common.saving") : t("tradeEdit.save")}
              </button>
            </div>
          </div>
        )}
        {unsavedDialog}
      </main>
    </div>
  );
}
