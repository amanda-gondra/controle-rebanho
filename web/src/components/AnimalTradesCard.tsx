import { Link } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import type { Animal } from "../types/animal.js";
import type { AnimalResult, TradeSide } from "../types/trade.js";
import { formatDate, formatMoney, formatNumber } from "../types/format.js";
import { formatTradeMoney, formatUnitPrice } from "../types/tradeLabels.js";
import { t } from "../i18n/index.js";

// Ficha do animal → "Compra e venda" (G5, F-NEG-06): a compra, a venda e a
// diferença venda − compra, SEMPRE com "não inclui custos" à vista.
// Registrar leva ao assistente de negociação com o animal já escolhido.

type Props = { animal: Animal; result: AnimalResult | null };

function sideLine(side: TradeSide) {
  const parts = [formatDate(side.date)];
  if (side.liveWeightKg) parts.push(t("units.kgValue", { value: formatNumber(Number(side.liveWeightKg)) }));
  parts.push(formatUnitPrice(side.priceUnit, side.unitPrice));
  return parts.join(" · ");
}

function Row({
  label,
  side,
  emptyText,
  action,
}: {
  label: string;
  side: TradeSide | null;
  emptyText: string;
  action: { to: string; label: string } | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-texto">{label}</p>
        <p className="text-xs text-texto-suave">{side ? sideLine(side) : emptyText}</p>
      </div>
      {side ? (
        <Link
          to={`/negociacoes/${side.tradeId}`}
          className="flex items-center gap-1 font-medium text-texto hover:text-verde shrink-0"
          title={t("animalTrades.openTrade")}
        >
          {formatTradeMoney(side.value)}
          <ChevronRight size={16} aria-hidden="true" />
          <span className="sr-only">{t("animalTrades.openTrade")}</span>
        </Link>
      ) : (
        action && (
          <Link
            to={action.to}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm font-medium hover:bg-bege shrink-0"
          >
            <Plus size={15} aria-hidden="true" /> {action.label}
          </Link>
        )
      )}
    </div>
  );
}

function Summary({ result }: { result: AnimalResult | null }) {
  const box = (title: string, value: string, tone = "text-texto") => (
    <div className="rounded-xl bg-bege p-4 mb-4">
      <p className="text-sm text-texto-suave mb-1">{title}</p>
      <p className={`text-xl font-medium ${tone}`}>{value}</p>
      <p className="text-xs text-texto-suave mt-1">{t("animalTrades.noCosts")}</p>
    </div>
  );

  switch (result?.kind) {
    case "DIFFERENCE": {
      const negative = result.difference!.startsWith("-");
      return box(
        t("animalTrades.difference"),
        formatMoney(Number(result.difference)),
        negative ? "text-alerta" : "text-verde",
      );
    }
    case "INVESTED":
      return box(t("animalTrades.invested"), formatMoney(Number(result.purchase!.value)));
    case "PENDING":
      return <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-4">{t("animalTrades.pending")}</p>;
    case "CURRENCY_MISMATCH":
      return (
        <p className="text-sm text-texto-suave bg-bege rounded-lg px-3 py-2 mb-4">{t("animalTrades.currencyMismatch")}</p>
      );
    case "SALE_ONLY":
      return <p className="text-sm text-texto-suave mb-4">{t("animalTrades.saleOnly")}</p>;
    default:
      return <p className="text-sm text-texto-suave mb-4">{t("animalTrades.help")}</p>;
  }
}

export function AnimalTradesCard({ animal, result }: Props) {
  const purchase = result?.purchase ?? null;
  const sale = result?.sale ?? null;
  const newTrade = (kind: "compra" | "venda") => `/negociacoes/nova?tipo=${kind}&animal=${animal.id}`;

  return (
    <div className="bg-card border border-borda rounded-xl p-6 mt-6">
      <p className="font-medium text-texto mb-4">{t("animalTrades.title")}</p>
      <Summary result={result} />
      <div className="flex flex-col divide-y divide-borda">
        <Row
          label={t("animalTrades.purchase")}
          side={purchase}
          emptyText={t("animalTrades.notRegistered")}
          action={{ to: newTrade("compra"), label: t("animalTrades.registerPurchase") }}
        />
        <Row
          label={t("animalTrades.sale")}
          side={sale}
          emptyText={animal.status === "DEAD" ? t("animalTrades.deadAnimal") : t("animalTrades.notRegistered")}
          action={animal.status === "DEAD" ? null : { to: newTrade("venda"), label: t("animalTrades.registerSale") }}
        />
      </div>
    </div>
  );
}
