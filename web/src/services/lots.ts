import { request } from "./api.js";
import type { Lot, LotApplication, LotDetail, LotMoveResult, LotWeighing } from "../types/lot.js";

export function listLots(includeArchived = false): Promise<Lot[]> {
  return request<Lot[]>(`/lots${includeArchived ? "?includeArchived=true" : ""}`);
}

export function getLot(id: string): Promise<LotDetail> {
  return request<LotDetail>(`/lots/${id}`);
}

export function createLot(data: { name: string; description?: string | null }): Promise<Lot> {
  return request<Lot>("/lots", { method: "POST", body: JSON.stringify(data) });
}

export function updateLot(id: string, data: { name?: string; description?: string | null }): Promise<Lot> {
  return request<Lot>(`/lots/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// Entram no lote (ou trocam de lote) na data
export function addAnimalsToLot(id: string, animalIds: string[], date: string): Promise<LotMoveResult> {
  return request<LotMoveResult>(`/lots/${id}/animals`, { method: "POST", body: JSON.stringify({ animalIds, date }) });
}

// Saem do lote (ficam sem lote) na data
export function removeAnimalsFromLot(id: string, animalIds: string[], date: string): Promise<LotMoveResult> {
  return request<LotMoveResult>(`/lots/${id}/remove`, { method: "POST", body: JSON.stringify({ animalIds, date }) });
}

export function setLotArchived(id: string, archived: boolean): Promise<Lot> {
  return request<Lot>(`/lots/${id}/${archived ? "archive" : "unarchive"}`, { method: "PATCH" });
}

export function deleteLot(id: string): Promise<void> {
  return request<void>(`/lots/${id}`, { method: "DELETE" });
}

export function getLotWeighings(id: string): Promise<LotWeighing[]> {
  return request<LotWeighing[]>(`/lots/${id}/weighings`);
}

export function getLotApplications(id: string): Promise<LotApplication[]> {
  return request<LotApplication[]>(`/lots/${id}/applications`);
}
