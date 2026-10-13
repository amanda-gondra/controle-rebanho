import { request } from "./api.js";
import type { CategoryLabels, CategoryLabelKey } from "../types/categories.js";

// Configurações da fazenda (G2). Os valores padrão vêm do servidor (`defaults`),
// para a tela não repetir números que já existem no backend.

export type PriceUnit = "PER_KG" | "PER_ARROBA" | "PER_HEAD";

export type FarmSettings = {
  arrobaLiveFactorKg: number;
  preferredPriceUnit: PriceUnit;
  reapplyAlertDays: number;
  defaultCastrated: boolean;
  categoryLabels: CategoryLabels; // os 7 nomes já resolvidos (G4)
};

export type Farm = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  weightUnit: string;
  settings: FarmSettings;
};

export type FarmWithDefaults = Farm & { defaults: FarmSettings };

// Campos que a 1.0 deixa alterar (país, moeda e unidade são fixos — D-30)
export type UpdateFarmInput = Partial<
  Pick<Farm, "name" | "timezone"> & Omit<FarmSettings, "categoryLabels">
> & {
  // só os nomes que mudaram; null = voltar ao padrão
  categoryLabels?: Partial<Record<CategoryLabelKey, string | null>>;
};

export function getFarm() {
  return request<FarmWithDefaults>("/farm");
}

export function updateFarm(input: UpdateFarmInput) {
  return request<FarmWithDefaults>("/farm", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
