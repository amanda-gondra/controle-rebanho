// Os "moldes" dos dados que vêm da API.
// Eles espelham exatamente o schema do backend (em inglês, como combinamos).

export type Sex = "MALE" | "FEMALE";
// Categorias da G4 (D-02): ver types/categories.ts (regra de sexo e nomes)
export type Category = "CALF" | "HEIFER" | "COW" | "YEARLING" | "ADULT_MALE" | "BULL";
export type Status = "ACTIVE" | "SOLD" | "DEAD";
export type BirthPrecision = "DAY_MONTH_YEAR" | "MONTH_YEAR" | "UNKNOWN";
export type DeathCauseCertainty = "CONFIRMED" | "SUSPECTED" | "NOT_INFORMED";
export type WeighingSource = "MANUAL" | "PURCHASE" | "SALE";
// De onde veio o animal (D-52). "Comprado" só vem da compra registrada.
export type AnimalOrigin = "BORN_ON_FARM" | "PURCHASED" | "RECEIVED" | "NOT_INFORMED";
export type TagChangeReason = "LOST" | "DAMAGED" | "TYPO" | "OTHER";

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
  origin: AnimalOrigin;
  entryDate: string | null; // entrada na fazenda (D-52)
  previousTag?: string | null; // brinco anterior, se houve troca (D-19 — ficha)
  notes: string | null;
  currentWeightKg?: number | null; // só vem na listagem (peso da última pesagem)
  lastWeighingDate?: string | null; // só vem na listagem (data da última pesagem, ISO)
  hasPurchase?: boolean; // só vem na listagem: já tem compra registrada (G5)
  hasSale?: boolean; // só vem na listagem: já tem venda registrada (G5)
  previousTags?: string[]; // só na busca: brincos antigos (achou pelo antigo)
  // Lote atual (D-49): na lista {id, name}; na ficha também desde quando
  lot?: { id: string; name: string; since?: string } | null;
  createdAt: string;
  updatedAt: string;
};

// Página da lista do rebanho (servidor — F-16)
export type AnimalPage = {
  items: Animal[];
  total: number;
  page: number;
  pageSize: number;
  counts: { ALL: number; ACTIVE: number; SOLD: number; DEAD: number }; // rebanho inteiro
};

// Linha do tempo (D-28): valores em código/JSON — a tela traduz (types/history.ts)
export type AnimalEventType =
  | "TAG_CHANGED"
  | "CATEGORY_CHANGED"
  | "SEX_CHANGED"
  | "BIRTH_CHANGED"
  | "STATUS_CHANGED"
  | "ORIGIN_CHANGED"
  | "LOT_CHANGED";

export type AnimalEvent = {
  id: string;
  animalId: string;
  type: AnimalEventType;
  fromValue: string | null;
  toValue: string | null;
  reason: TagChangeReason | null;
  effectiveDate: string; // AAAA-MM-DD
  userName: string | null;
  createdAt: string;
};

export type AnimalHistory = {
  createdAt: string;
  items: AnimalEvent[];
  total: number;
  page: number;
  pageSize: number;
};

export type DeleteImpact = { weighings: number; applications: number; hasTransactions: boolean };

export type Weighing = {
  id: string;
  animalId: string;
  date: string;
  weightKg: string;
  source: WeighingSource; // manual, ou criada por compra/venda (só muda pela negociação)
  // Ganho desde a anterior (RN-PES-008); null na primeira pesagem
  gainSincePrevious?: { gainKg: number; days: number; dailyGainKg: number | null } | null;
  createdAt: string;
};

export type WeightGain = {
  firstWeightKg: number;
  lastWeightKg: number;
  totalGainKg: number;
  days: number;
  averageDailyGainKg: number;
  startDate: string; // período do GMD (RN-PES-007)
  endDate: string;
};

// ── Manejo sanitário (v2) ──

export type ProductType = "VACCINE" | "DEWORMER" | "EXTERNAL_PARASITICIDE" | "OTHER";
export const PRODUCT_TYPES: ProductType[] = ["VACCINE", "DEWORMER", "EXTERNAL_PARASITICIDE", "OTHER"];
export type DoseUnit = "ML" | "G" | "DOSE";

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  purpose: string | null; // "para que serve", escrito pelo produtor
  manufacturer: string | null;
  // Carência em dias, da bula (D-12). null = "não informada" (nunca zero)
  withdrawalDays: number | null;
  notes: string | null;
  archivedAt: string | null;
  usageCount?: number; // em quantas aplicações foi usado
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
  doseAmount: string | null; // dose aplicada (RN-SAN-013) — só registro
  doseUnit: DoseUnit | null;
  batchNumber: string | null; // partida/lote do frasco
  withdrawalDays: number | null; // carência copiada do produto no dia
  withdrawalEndDate: string | null;
  reappliesApplicationId: string | null;
  reminderDismissedAt: string | null;
  reminderDismissReason: string | null;
  animals?: ApplicationAnimal[];
  reappliedBy?: { id: string; date: string }[]; // só no detalhe
  _count?: { animals: number };
  overdue?: boolean; // só vem na rota de lembretes (se já venceu)
  activeAnimalIds?: string[]; // só nos lembretes: animais do grupo ainda ativos
  activeAnimalsCount?: number;
  inWithdrawal?: boolean; // só na ficha: em carência hoje
  createdAt: string;
};

// Compra e venda (G5): ver types/trade.ts
