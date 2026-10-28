import { request } from "./api.js";
import type {
  DeathCauseCertainty,
  Animal,
  Status,
  Category,
  Sex,
  BirthPrecision,
  Weighing,
  WeightGain,
  AnimalOrigin,
  AnimalHistory,
  DeleteImpact,
  TagChangeReason,
  AnimalPage,
} from "../types/animal.js";

// Lista do rebanho, paginada e filtrada NO SERVIDOR (F-16). `q` busca por
// brinco (atual ou antigo), raça e nome da categoria; `tag` é o brinco exato.
export type AnimalFilters = {
  q?: string;
  tag?: string;
  status?: Status;
  category?: Category;
  sex?: Sex;
  lotId?: string; // id do lote ou "none" (sem lote)
  sortBy?: "tag" | "createdAt";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export function listAnimals(filters: AnimalFilters = {}): Promise<AnimalPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return request<AnimalPage>(`/animals${query ? `?${query}` : ""}`);
}

// Para as telas de SELEÇÃO (aplicação, negociação, lote): todos os animais do
// filtro de uma vez (até o limite técnico da API)
export const MAX_PICKER_ANIMALS = 5000;
export async function listAllAnimals(filters: Omit<AnimalFilters, "page" | "pageSize"> = {}): Promise<Animal[]> {
  const page = await listAnimals({ ...filters, page: 1, pageSize: MAX_PICKER_ANIMALS });
  return page.items;
}

export function getAnimal(id: string): Promise<Animal> {
  return request<Animal>(`/animals/${id}`);
}

export type CreateAnimalInput = {
  tag: string;
  sex: Sex;
  category: Category;
  castrated?: boolean; // só machos; sem valor → padrão da fazenda
  breed?: string;
  birthDate?: string;
  birthPrecision: BirthPrecision;
  origin?: Exclude<AnimalOrigin, "PURCHASED">; // "comprado" só pela compra (D-52)
  entryDate?: string;
  notes?: string;
};

export function createAnimal(data: CreateAnimalInput): Promise<Animal> {
  return request<Animal>("/animals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listWeighings(animalId: string): Promise<Weighing[]> {
  return request<Weighing[]>(`/animals/${animalId}/weighings`);
}

export function getWeightGain(animalId: string): Promise<WeightGain> {
  return request<WeightGain>(`/animals/${animalId}/weight-gain`);
}

export function createWeighing(
  animalId: string,
  data: { date: string; weightKg: number },
): Promise<Weighing> {
  return request<Weighing>(`/animals/${animalId}/weighings`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Mudar situação (D-27): ao sair (vendido/morto) vai a data de saída; na
// morte, causa e certeza. Voltar para ativo apaga a saída.
export type UpdateStatusInput = {
  status: Status;
  exitDate?: string;
  deathCause?: string | null;
  deathCauseCertainty?: DeathCauseCertainty;
};

export function updateStatus(id: string, input: UpdateStatusInput): Promise<Animal> {
  return request<Animal>(`/animals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAnimal(id: string): Promise<void> {
  return request<void>(`/animals/${id}`, { method: "DELETE" });
}

// O que o formulário de edição envia (sem a tag — não se edita o brinco).
export type UpdateAnimalInput = {
  sex?: Sex;
  category?: Category;
  castrated?: boolean; // só machos
  breed?: string;
  birthDate?: string;
  birthPrecision?: BirthPrecision;
  origin?: Exclude<AnimalOrigin, "PURCHASED">;
  entryDate?: string | null;
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

// Edita uma pesagem existente (corrige data/peso).
export function updateWeighing(
  animalId: string,
  weighingId: string,
  data: { date: string; weightKg: number },
): Promise<Weighing> {
  return request<Weighing>(`/animals/${animalId}/weighings/${weighingId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Exclui uma pesagem.
export function deleteWeighing(
  animalId: string,
  weighingId: string,
): Promise<void> {
  return request<void>(`/animals/${animalId}/weighings/${weighingId}`, {
    method: "DELETE",
  });
}

// Troca de brinco (D-19): o histórico continua no mesmo animal
export function changeTag(
  animalId: string,
  data: { newTag: string; reason: TagChangeReason; date: string },
): Promise<Animal> {
  return request<Animal>(`/animals/${animalId}/tag-changes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Linha do tempo (D-28), mais recente primeiro
export function getAnimalHistory(animalId: string, page = 1, pageSize = 20): Promise<AnimalHistory> {
  return request<AnimalHistory>(`/animals/${animalId}/history?page=${page}&pageSize=${pageSize}`);
}

// O que some junto ao excluir (F-ANI-07)
export function getDeleteImpact(animalId: string): Promise<DeleteImpact> {
  return request<DeleteImpact>(`/animals/${animalId}/delete-impact`);
}
