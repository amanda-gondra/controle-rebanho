import type { FarmDb } from "../lib/tenant.js";
import { calendarDateOf } from "../lib/dates.js";
import { centsToString, stringToCents } from "./trade.service.js";

// Resultado por animal (RN-NEG-012): venda − compra, SEM custos. Nunca é
// chamado de "lucro". O valor estimado do animal vivo saiu da 1.0 (D-09).

// Um lado da conta (a compra ou a venda do animal)
export type TradeSide = {
  tradeId: string;
  itemId: string;
  date: string;
  priceUnit: string;
  arrobaBasis: string | null;
  liveWeightKg: string | null;
  carcassWeightKg: string | null;
  unitPrice: string;
  value: string | null; // null = aguardando o peso de carcaça (D-35)
  currency: string;
};

// O que a ficha mostra:
// - DIFFERENCE        → comprou e vendeu: diferença venda − compra
// - INVESTED          → só comprou: quanto foi investido
// - SALE_ONLY         → só vendeu (nasceu na fazenda ou compra não informada)
// - PENDING           → falta o valor de um dos lados (romaneio)
// - CURRENCY_MISMATCH → moedas diferentes: não calcula e avisa
// - null              → sem compra nem venda
export type ResultKind = "DIFFERENCE" | "INVESTED" | "SALE_ONLY" | "PENDING" | "CURRENCY_MISMATCH";

export type AnimalResult = {
  purchase: TradeSide | null;
  sale: TradeSide | null;
  kind: ResultKind | null;
  difference: string | null; // pode ser negativa ("-150.00")
};

function signedCents(cents: bigint): string {
  return cents < 0n ? `-${centsToString(-cents)}` : centsToString(cents);
}

// A CONTA PURA (sem banco)
export function computeAnimalResult(purchase: TradeSide | null, sale: TradeSide | null): AnimalResult {
  const base = { purchase, sale, difference: null };

  if (!purchase && !sale) return { ...base, kind: null };
  if (purchase && sale && purchase.currency !== sale.currency) {
    return { ...base, kind: "CURRENCY_MISMATCH" };
  }
  if ((purchase && purchase.value === null) || (sale && sale.value === null)) {
    return { ...base, kind: "PENDING" };
  }
  if (purchase && !sale) return { ...base, kind: "INVESTED" };
  if (sale && !purchase) return { ...base, kind: "SALE_ONLY" };

  const difference = stringToCents(sale!.value!) - stringToCents(purchase!.value!);
  return { ...base, kind: "DIFFERENCE", difference: signedCents(difference) };
}

// Busca a compra e a venda do animal e chama a conta pura
export async function calculateAnimalResult(db: FarmDb, animalId: string): Promise<AnimalResult> {
  const items = await db.tradeItem.findMany({
    where: { animalId },
    include: {
      trade: {
        select: { id: true, date: true, priceUnit: true, arrobaBasis: true, currency: true },
      },
    },
  });

  const toSide = (type: "PURCHASE" | "SALE"): TradeSide | null => {
    const item = items.find((candidate) => candidate.type === type);
    if (!item) return null;
    return {
      tradeId: item.trade.id,
      itemId: item.id,
      date: calendarDateOf(item.trade.date),
      priceUnit: item.trade.priceUnit,
      arrobaBasis: item.trade.arrobaBasis,
      liveWeightKg: item.liveWeightKg?.toFixed(2) ?? null,
      carcassWeightKg: item.carcassWeightKg?.toFixed(2) ?? null,
      unitPrice: item.unitPrice.toFixed(2),
      value: item.value?.toFixed(2) ?? null,
      currency: item.trade.currency,
    };
  };

  return computeAnimalResult(toSide("PURCHASE"), toSide("SALE"));
}
