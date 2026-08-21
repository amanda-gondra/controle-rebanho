import { request } from "./api.js";
import type {
  Animal,
  Status,
  Category,
  Sex,
  BirthPrecision,
  Weighing,
  WeightGain,
} from "../types/animal.js";

export function listAnimals(filters?: {
  status?: Status;
  category?: Category;
}): Promise<Animal[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  const query = params.toString();
  return request<Animal[]>(`/animals${query ? `?${query}` : ""}`);
}

export function getAnimal(id: string): Promise<Animal> {
  return request<Animal>(`/animals/${id}`);
}

export type CreateAnimalInput = {
  tag: string;
  sex: Sex;
  category: Category;
  breed?: string;
  birthDate?: string;
  birthPrecision: BirthPrecision;
  notes?: string;
};

export function createAnimal(data: CreateAnimalInput): Promise<Animal> {
  return request<Animal>("/animals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listWeighings(animalId: string): Promise<Weighing[]> {
  return request<Weighing[]>(`/animals/${animalId}/pesagens`);
}

export function getWeightGain(animalId: string): Promise<WeightGain> {
  return request<WeightGain>(`/animals/${animalId}/ganho-peso`);
}

export function createWeighing(
  animalId: string,
  data: { date: string; weightKg: number },
): Promise<Weighing> {
  return request<Weighing>(`/animals/${animalId}/pesagens`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateStatus(id: string, status: Status): Promise<Animal> {
  return request<Animal>(`/animals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteAnimal(id: string): Promise<void> {
  return request<void>(`/animals/${id}`, { method: "DELETE" });
}

// O que o formulário de edição envia (sem a tag — não se edita o brinco).
export type UpdateAnimalInput = {
  sex?: Sex;
  category?: Category;
  breed?: string;
  birthDate?: string;
  birthPrecision?: BirthPrecision;
  notes?: string;
};

export function updateAnimal(
  id: string,
  data: UpdateAnimalInput,
): Promise<Animal> {
  return request<Animal>(`/animals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}