import { request } from "./api.js";
import type { Purchase, Sale, AnimalResult } from "../types/animal.js";

// O que os formulários de compra e venda enviam (mesma forma nos dois).
export type TradeInput = {
  date: string;
  weightKg: number;
  pricePerKg: number;
  notes?: string;
};

// ── Compra ──

export function getPurchase(animalId: string): Promise<Purchase> {
  return request<Purchase>(`/animals/${animalId}/purchase`);
}

export function createPurchase(
  animalId: string,
  data: TradeInput,
): Promise<Purchase> {
  return request<Purchase>(`/animals/${animalId}/purchase`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePurchase(
  animalId: string,
  data: TradeInput,
): Promise<Purchase> {
  return request<Purchase>(`/animals/${animalId}/purchase`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePurchase(animalId: string): Promise<void> {
  return request<void>(`/animals/${animalId}/purchase`, { method: "DELETE" });
}

// ── Venda (registrar venda também marca o animal como vendido) ──

export function getSale(animalId: string): Promise<Sale> {
  return request<Sale>(`/animals/${animalId}/sale`);
}

export function createSale(
  animalId: string,
  data: TradeInput,
): Promise<Sale> {
  return request<Sale>(`/animals/${animalId}/sale`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSale(animalId: string, data: TradeInput): Promise<Sale> {
  return request<Sale>(`/animals/${animalId}/sale`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Desfaz a venda e volta o animal para ativo.
export function deleteSale(animalId: string): Promise<void> {
  return request<void>(`/animals/${animalId}/sale`, { method: "DELETE" });
}

// ── Preço estimado ──

// Informa (número) ou limpa (null) o preço/kg estimado do animal vivo.
export function setEstimatedPrice(
  animalId: string,
  pricePerKg: number | null,
): Promise<void> {
  return request<void>(`/animals/${animalId}/estimated-price`, {
    method: "PATCH",
    body: JSON.stringify({ pricePerKg }),
  });
}

// ── Resultado ──

export function getAnimalResult(animalId: string): Promise<AnimalResult> {
  return request<AnimalResult>(`/animals/${animalId}/result`);
}
