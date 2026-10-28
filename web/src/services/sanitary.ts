import { request } from "./api.js";
import type { Product, ProductType, Application, DoseUnit, ApplicationsSummary } from "../types/animal.js";

// ── Produtos ──

// Produtos ativos (seleção da aplicação), por tipo; com `includeArchived`,
// também os arquivados (tela de Produtos).
export function listProducts(type?: ProductType, includeArchived = false): Promise<Product[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  return request<Product[]>(`/products${query ? `?${query}` : ""}`);
}

export type ProductInput = {
  name: string;
  type: ProductType;
  purpose?: string | null;
  manufacturer?: string | null;
  withdrawalDays?: number | null;
  notes?: string | null;
};

export function createProduct(data: ProductInput): Promise<Product> {
  return request<Product>("/products", { method: "POST", body: JSON.stringify(data) });
}

export function updateProduct(id: string, data: Partial<ProductInput>): Promise<Product> {
  return request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// Arquivar: some da seleção, o histórico continua (F-18)
export function setProductArchived(id: string, archived: boolean): Promise<Product> {
  return request<Product>(`/products/${id}/${archived ? "archive" : "unarchive"}`, { method: "PATCH" });
}

// Só produto nunca usado (senão PRODUCT_IN_USE)
export function deleteProduct(id: string): Promise<void> {
  return request<void>(`/products/${id}`, { method: "DELETE" });
}

// ── Aplicações ──

export type ApplicationInput = {
  productId: string;
  date: string;
  reapplyDate?: string | null;
  notes?: string;
  batchNumber?: string | null;
  doseAmount?: number | null;
  doseUnit?: DoseUnit | null;
  animalIds: string[];
};

// Registra uma aplicação (em lote). `reappliesApplicationId`: registrada a
// partir de um lembrete (ele sai da lista). `idempotencyKey`: o mesmo em todas
// as tentativas da tela (não grava duas vezes).
export function createApplication(
  data: ApplicationInput & { reappliesApplicationId?: string; idempotencyKey?: string },
): Promise<Application> {
  return request<Application>("/applications", { method: "POST", body: JSON.stringify(data) });
}

export type ApplicationFilters = { type?: ProductType; q?: string; from?: string; to?: string };

export function listApplications(filters: ApplicationFilters = {}): Promise<Application[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const text = query.toString();
  return request<Application[]>(`/applications${text ? `?${text}` : ""}`);
}

export function getApplicationsSummary(period: { from?: string; to?: string } = {}): Promise<ApplicationsSummary> {
  const query = new URLSearchParams();
  if (period.from) query.set("from", period.from);
  if (period.to) query.set("to", period.to);
  const text = query.toString();
  return request<ApplicationsSummary>(`/applications/summary${text ? `?${text}` : ""}`);
}

export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${id}`);
}

// Histórico sanitário de um animal (ficha), com carência
export function listAnimalApplications(animalId: string): Promise<Application[]> {
  return request<Application[]>(`/animals/${animalId}/applications`);
}

// Lembretes de reaplicação (antecedência das Configurações) e vencidos
export function listAlerts(): Promise<Application[]> {
  return request<Application[]>("/alerts");
}

// "Dispensar" o lembrete (D-40), motivo opcional
export function dismissReminder(id: string, reason?: string): Promise<Application> {
  return request<Application>(`/applications/${id}/dismiss-reminder`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

// Corrige uma aplicação: dados e, se mandar `animalIds`, os animais
export function updateApplication(
  id: string,
  data: Omit<ApplicationInput, "animalIds"> & { animalIds?: string[] },
): Promise<Application> {
  return request<Application>(`/applications/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteApplication(id: string): Promise<void> {
  return request<void>(`/applications/${id}`, { method: "DELETE" });
}
