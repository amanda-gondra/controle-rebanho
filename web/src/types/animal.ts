// Os "moldes" dos dados que vêm da API.
// Eles espelham exatamente o schema do backend (em inglês, como combinamos).

export type Sex = "MALE" | "FEMALE";
// Categorias da G4 (D-02): ver types/categories.ts (regra de sexo e nomes)
export type Category = "CALF" | "HEIFER" | "COW" | "YEARLING" | "ADULT_MALE" | "BULL";
export type Status = "ACTIVE" | "SOLD" | "DEAD";
export type BirthPrecision = "DAY_MONTH_YEAR" | "MONTH_YEAR" | "UNKNOWN";
export type DeathCauseCertainty = "CONFIRMED" | "SUSPECTED" | "NOT_INFORMED";
export type WeighingSource = "MANUAL" | "PURCHASE" | "SALE";

export type Animal = {
  id: string;
  tag: string;
  sex: Sex;
  breed: string | null;
  category: Category;
  castrated: boolean | null; // só machos (fêmea = null)
  status: Status;
  // Saída (D-27): data em que foi vendido ou morreu; na morte, causa e certeza
  exitDate: string | null;
  deathCause: string | null;
  deathCauseCertainty: DeathCauseCertainty | null;
  birthDate: string | null;
  birthPrecision: BirthPrecision;
  notes: string | null;
  currentWeightKg?: number | null; // só vem na listagem (peso da última pesagem)
  lastWeighingDate?: string | null; // só vem na listagem (data da última pesagem, ISO)
  hasPurchase?: boolean; // só vem na listagem: já tem compra registrada (G5)
  hasSale?: boolean; // só vem na listagem: já tem venda registrada (G5)
  createdAt: string;
  updatedAt: string;
};

export type Weighing = {
  id: string;
  animalId: string;
  date: string;
  weightKg: string;
  source: WeighingSource; // manual, ou criada por compra/venda (só muda pela negociação)
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
  reapplyDate: string | null;
  notes: string | null;
  animals?: ApplicationAnimal[];
  _count?: { animals: number };
  overdue?: boolean; // só vem na rota de alertas (se já venceu)
  createdAt: string;
};

// Compra e venda (G5): ver types/trade.ts
