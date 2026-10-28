import type { ArrobaBasis, PriceUnit, TradeType } from "./trade.js";
import { formatMoney, formatNumber } from "./format.js";
import { t } from "../i18n/index.js";

// Textos das negociações que dependem da forma de preço (G5). Rótulos claros:
// "R$ por kg", "R$ por arroba (carcaça)", "R$ por arroba (peso vivo ÷ 30)",
// "R$ por cabeça" — nunca um número sem dizer de quê.

export const tradeTypeLabel = (type: TradeType) =>
  type === "SALE" ? t("trade.typeSALE") : t("trade.typePURCHASE");

const factorText = (factor: string | number | null) => formatNumber(Number(factor ?? 0));

// "R$ por arroba (peso vivo ÷ 30)" — para títulos e campos de preço
export function priceUnitLabel(priceUnit: PriceUnit, basis: ArrobaBasis | null, factor: string | number | null) {
  if (priceUnit === "PER_KG") return t("trade.unitPER_KG");
  if (priceUnit === "PER_HEAD") return t("trade.unitPER_HEAD");
  if (basis === "LIVE_FACTOR") return t("trade.unitPER_ARROBA_LIVE", { factor: factorText(factor) });
  if (basis === "CARCASS") return t("trade.unitPER_ARROBA_CARCASS");
  return t("trade.unitPER_ARROBA");
}

// "Por arroba (carcaça)" — a forma de preço, sem o fator (listas)
export function priceFormLabel(priceUnit: PriceUnit, basis: ArrobaBasis | null) {
  if (priceUnit === "PER_ARROBA") return t(basis === "LIVE_FACTOR" ? "trade.basisLIVE_FACTOR" : "trade.basisCARCASS");
  return t(priceUnit === "PER_KG" ? "trade.choicePER_KG" : "trade.choicePER_HEAD");
}

// "R$ 12,33/kg", "R$ 300,00/@", "R$ 3.000,00/cabeça"
export function formatUnitPrice(priceUnit: PriceUnit, price: string | number) {
  const value = formatMoney(Number(price));
  if (priceUnit === "PER_KG") return t("units.perKg", { value });
  if (priceUnit === "PER_HEAD") return t("units.perHead", { value });
  return t("units.perArroba", { value });
}

// Total de uma negociação: com animal aguardando o peso de carcaça, mostra a
// soma conhecida como "parcial" (ou "aguardando valor", se nada tem valor ainda)
export function formatTradeTotal(trade: { total: string | null; knownTotal: string; pending: boolean }) {
  if (!trade.pending) return formatTradeMoney(trade.total);
  if (Number(trade.knownTotal) === 0) return t("trade.pendingValue");
  return t("trade.partialTotal", { total: formatMoney(Number(trade.knownTotal)) });
}

// Valor em reais vindo da API ("4500.00"); null = pendente
export const formatTradeMoney = (value: string | null) =>
  value === null ? t("trade.pendingValue") : formatMoney(Number(value));
