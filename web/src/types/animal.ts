// Os "moldes" dos dados que vêm da API.
// Eles espelham exatamente o schema do backend (em inglês, como combinamos).

export type Sex = "MALE" | "FEMALE";
export type Category = "CALF" | "YEARLING" | "STEER" | "COW";
export type Status = "ACTIVE" | "SOLD" | "DEAD";
export type BirthPrecision = "DAY_MONTH_YEAR" | "MONTH_YEAR" | "UNKNOWN";

export type Animal = {
  id: string;
  tag: string;
  sex: Sex;
  breed: string | null;
  category: Category;
  status: Status;
  birthDate: string | null;
  birthPrecision: BirthPrecision;
  notes: string | null;
  currentWeightKg?: number | null; // só vem na listagem (peso da última pesagem)
  createdAt: string;
  updatedAt: string;
};

export type Weighing = {
  id: string;
  animalId: string;
  date: string;
  weightKg: string;
  createdAt: string;
};

export type WeightGain = {
  firstWeightKg: number;
  lastWeightKg: number;
  totalGainKg: number;
  days: number;
  averageDailyGainKg: number;
};