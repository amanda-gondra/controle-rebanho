// Lotes (D-49) — regras puras, testadas em lot.service.test.ts.
// Datas "AAAA-MM-DD" (comparáveis como texto).

export type LotMoveProblem =
  | "ANIMAL_NOT_ACTIVE" // vendido ou morto não muda de lote
  | "LOT_DATE_OUT_OF_LIFE" // antes do nascimento (dia certo) ou depois da saída
  | "LOT_DATE_BEFORE_CURRENT"; // antes de entrar no lote atual (os períodos não se cruzam)

export type LotMovePlan = { kind: "MOVE" } | { kind: "UNCHANGED" } | { kind: "PROBLEM"; problem: LotMoveProblem };

// O que fazer com um animal ao mover para `targetLotId` (null = tirar do lote)
export function planLotMove(input: {
  targetLotId: string | null;
  date: string;
  active: boolean;
  outsideLife: boolean;
  open: { lotId: string; startDate: string } | null;
}): LotMovePlan {
  const sameLot = (input.open?.lotId ?? null) === input.targetLotId;
  if (sameLot) return { kind: "UNCHANGED" }; // já está lá (ou já sem lote): nada a fazer
  if (!input.active) return { kind: "PROBLEM", problem: "ANIMAL_NOT_ACTIVE" };
  if (input.outsideLife) return { kind: "PROBLEM", problem: "LOT_DATE_OUT_OF_LIFE" };
  // A troca fecha o período atual na data: ela não pode ser antes da entrada
  if (input.open && input.date < input.open.startDate) return { kind: "PROBLEM", problem: "LOT_DATE_BEFORE_CURRENT" };
  return { kind: "MOVE" };
}
