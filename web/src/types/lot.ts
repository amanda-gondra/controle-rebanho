import type { Category, Sex, Status } from "./animal.js";

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

export type LotDetail = Lot & {
  animals: { id: string; tag: string; sex: Sex; category: Category; status: Status; breed: string | null; since: string }[];
  history: { id: string; animal: { id: string; tag: string }; startDate: string; endDate: string | null }[];
};

export type LotMoveResult = { moved: number; unchanged: number };
