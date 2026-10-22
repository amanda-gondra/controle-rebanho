import type { Category, ProductType, Sex, Status } from "./animal.js";

// Lotes (D-49): um animal está em no máximo um lote por vez; entrada e saída
// ficam guardadas com data.
export type Lot = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  activeCount: number; // animais ativos no lote agora
  createdAt: string;
};

export type LotSummary = {
  males: number;
  females: number;
  averageWeightKg: number | null;
  weighedAnimals: number;
  lastWeighingDate: string | null;
  gain: { averageDailyGainKg: number | null; animalsWithGain: number; animalsWithoutGain: number; from: string | null; to: string | null };
};

export type LotAnimal = {
  id: string;
  tag: string;
  sex: Sex;
  category: Category;
  status: Status;
  breed: string | null;
  since: string;
  currentWeightKg: number | null;
  lastWeighingDate: string | null;
};

export type LotWeighing = { id: string; date: string; weightKg: string; source: string; animal: { id: string; tag: string } };
export type LotApplication = {
  id: string;
  date: string;
  reapplyDate: string | null;
  product: { id: string; name: string; type: ProductType };
  animalsTotal: number;
  animalsInLot: number;
};

export type LotDetail = Lot & {
  formedOn: string | null; // primeira entrada de animal no lote
  summary: LotSummary;
  animals: LotAnimal[];
  history: { id: string; animal: { id: string; tag: string }; startDate: string; endDate: string | null }[];
};

export type LotMoveResult = { moved: number; unchanged: number };
