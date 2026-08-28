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

// ── Manejo sanitário (v2) ──

export type ProductType = "VACCINE" | "DEWORMER";

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  createdAt: string;
};

// A "ponte" — liga uma aplicação a um animal (pode trazer o animal junto)
export type ApplicationAnimal = {
  id: string;
  applicationId: string;
  animalId: string;
  animal?: Animal;
};

// Uma aplicação (evento). Alguns campos só vêm em certas rotas:
// - _count.animals: na listagem (quantos animais no evento)
// - animals: nos detalhes (a lista de animais do lote)
export type Application = {
  id: string;
  productId: string;
  product: Product;
  date: string;
  notes: string | null;
  animals?: ApplicationAnimal[];
  _count?: { animals: number };
  createdAt: string;
};