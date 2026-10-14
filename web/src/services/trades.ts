import { request } from "./api.js";
import type { Category, Sex } from "../types/animal.js";
import type {
  AnimalResult,
  ArrobaBasis,
  LastPrices,
  PriceUnit,
  Trade,
  TradePage,
  TradeType,
} from "../types/trade.js";

// Negociações — compra e venda (G5). O servidor calcula valores e total;
// a tela só manda pesos e preços.

// Animal novo cadastrado junto com a compra (D-36)
export type NewAnimalInput = {
  tag: string;
  sex: Sex;
  category: Category;
  castrated?: boolean;
  breed?: string;
};

// Cada linha: um animal já cadastrado (animalId) OU um animal novo (só na compra)
export type NewTradeItem = ({ animalId: string; newAnimal?: never } | { newAnimal: NewAnimalInput; animalId?: never }) & {
  liveWeightKg: string | null;
  carcassWeightKg: string | null;
  unitPrice: string;
  priceAdjusted: boolean;
};

export type NewTrade = {
  type: TradeType;
  date: string;
  priceUnit: PriceUnit;
  arrobaBasis?: ArrobaBasis;
  arrobaFactorKg?: number;
  counterparty?: string;
  notes?: string;
  idempotencyKey: string; // mesmo valor ao tentar de novo = sem negociação duplicada
  items: NewTradeItem[];
};

export type TradeItemUpdate = {
  id: string;
  liveWeightKg?: string | null;
  carcassWeightKg?: string | null;
  unitPrice?: string;
  priceAdjusted?: boolean;
};

export type TradeUpdate = {
  date?: string;
  priceUnit?: PriceUnit;
  arrobaBasis?: ArrobaBasis | null;
  arrobaFactorKg?: number | null;
  counterparty?: string | null;
  notes?: string | null;
  items?: TradeItemUpdate[];
};

export type TradeFilters = {
  type?: TradeType;
  from?: string;
  to?: string;
  pending?: boolean;
  page?: number;
  pageSize?: number;
};

// Pesos e preços vão como número no JSON (o servidor confere as 2 casas)
const toNumber = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : Number(value);

export function createTrade(input: NewTrade) {
  return request<Trade>("/trades", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      items: input.items.map((item) => ({
        ...item,
        liveWeightKg: toNumber(item.liveWeightKg),
        carcassWeightKg: toNumber(item.carcassWeightKg),
        unitPrice: Number(item.unitPrice),
      })),
    }),
  });
}

export function listTrades(filters: TradeFilters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  return request<TradePage>(`/trades${suffix}`);
}

export function getTrade(id: string) {
  return request<Trade>(`/trades/${id}`);
}

export function updateTrade(id: string, input: TradeUpdate) {
  return request<Trade>(`/trades/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...input,
      items: input.items?.map((item) => ({
        ...item,
        liveWeightKg: toNumber(item.liveWeightKg),
        carcassWeightKg: toNumber(item.carcassWeightKg),
        unitPrice: toNumber(item.unitPrice),
      })),
    }),
  });
}

// Tira um animal; se era o último, a negociação deixa de existir
export function removeTradeItem(tradeId: string, itemId: string) {
  return request<{ tradeDeleted: boolean }>(`/trades/${tradeId}/items/${itemId}`, { method: "DELETE" });
}

export function deleteTrade(id: string) {
  return request<void>(`/trades/${id}`, { method: "DELETE" });
}

export function getLastPrices(type: TradeType, priceUnit: PriceUnit, arrobaBasis: ArrobaBasis | null) {
  const query = new URLSearchParams({ type, priceUnit });
  if (priceUnit === "PER_ARROBA" && arrobaBasis) query.set("arrobaBasis", arrobaBasis);
  return request<LastPrices>(`/trades/last-prices?${query}`);
}

// Compra, venda e diferença venda − compra do animal (sem custos)
export function getAnimalResult(animalId: string) {
  return request<AnimalResult>(`/animals/${animalId}/result`);
}
