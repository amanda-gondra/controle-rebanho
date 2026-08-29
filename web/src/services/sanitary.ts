import { request } from "./api.js";
import type { Product, ProductType, Application } from "../types/animal.js";

// ── Produtos ──

// Lista os produtos (opcionalmente filtrando por tipo: vacina ou vermífugo).
export function listProducts(type?: ProductType): Promise<Product[]> {
  const query = type ? `?type=${type}` : "";
  return request<Product[]>(`/products${query}`);
}

// Cadastra um produto novo.
export function createProduct(data: {
  name: string;
  type: ProductType;
}): Promise<Product> {
  return request<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Aplicações ──

// Registra uma aplicação (em lote): produto, data, observação e os animais.
export function createApplication(data: {
  productId: string;
  date: string;
  reapplyDate?: string;
  notes?: string;
  animalIds: string[];
}): Promise<Application> {
  return request<Application>("/applications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Lista as aplicações (histórico por evento; filtro opcional por tipo).
export function listApplications(type?: ProductType): Promise<Application[]> {
  const query = type ? `?type=${type}` : "";
  return request<Application[]>(`/applications${query}`);
}

// Detalhes de uma aplicação (com os animais daquele lote).
export function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${id}`);
}

// Histórico sanitário de um animal (para a ficha).
export function listAnimalApplications(
  animalId: string,
): Promise<Application[]> {
  return request<Application[]>(`/animals/${animalId}/applications`);
}

// Reaplicações chegando (próximos 7 dias) ou vencidas.
export function listAlerts(): Promise<Application[]> {
  return request<Application[]>("/alerts");
}