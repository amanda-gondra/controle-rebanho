import type { Category, Sex, Status } from "./animal.js";
import type { PriceUnit } from "../services/farm.js";

// Negociações — compra e venda (G5). Espelham as respostas da API.
// Dinheiro e peso chegam como TEXTO com 2 casas ("4500.00"): nunca viram
// conta de ponto flutuante na tela (ver tradeMath.ts).

export type { PriceUnit };
export type TradeType = "PURCHASE" | "SALE";
export type ArrobaBasis = "CARCASS" | "LIVE_FACTOR";

export type TradeAnimal = {
  id: string;
  tag: string;
  sex: Sex;
  category: Category;
  breed: string | null;
  status: Status;
};

export type TradeItem = {
  id: string;
  animal: TradeAnimal;
  liveWeightKg: string | null;
  carcassWeightKg: string | null; // vazio na arroba de carcaça = aguardando romaneio
  unitPrice: string;
  priceAdjusted: boolean;
  value: string | null; // null = pendente
  hasWeighing: boolean;
};

export type Trade = {
  id: string;
  type: TradeType;
  date: string;
  priceUnit: PriceUnit;
  arrobaBasis: ArrobaBasis | null;
  arrobaFactorKg: string | null;
  currency: string;
  counterparty: string | null;
  notes: string | null;
  withdrawalWarningAccepted?: boolean; // venda registrada com aviso de carência aceito (D-12)
  animalCount: number;
  total: string | null; // null quando falta peso de carcaça
  knownTotal: string;
  pending: boolean;
  items: TradeItem[];
  replacedWeighings?: number; // só ao gravar: pesagens manuais do dia substituídas
};

export type TradeSummary = Omit<Trade, "items" | "notes" | "arrobaFactorKg" | "replacedWeighings">;

export type TradePage = {
  page: number;
  pageSize: number;
  total: number;
  items: TradeSummary[];
};

export type LastPrice = { group: string; breed?: string | null; unitPrice: string; date: string };
export type LastPrices = { byCategory: LastPrice[]; byCategoryAndBreed: LastPrice[] };

// ── Resultado por animal (venda − compra, sem custos) ──

export type TradeSide = {
  tradeId: string;
  itemId: string;
  date: string;
  priceUnit: PriceUnit;
  arrobaBasis: ArrobaBasis | null;
  liveWeightKg: string | null;
  carcassWeightKg: string | null;
  unitPrice: string;
  value: string | null;
  currency: string;
};

export type ResultKind = "DIFFERENCE" | "INVESTED" | "SALE_ONLY" | "PENDING" | "CURRENCY_MISMATCH";

export type AnimalResult = {
  purchase: TradeSide | null;
  sale: TradeSide | null;
  kind: ResultKind | null;
  difference: string | null;
};
