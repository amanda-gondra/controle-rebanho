// Saída do animal (D-27) — regras puras, testadas em exit.service.test.ts.
//
// Todas as datas aqui são de calendário, "AAAA-MM-DD" (podem ser comparadas
// como texto).

// O que pode impedir uma data de saída (RN-ANIMAL-011): ela não pode ser
// anterior ao nascimento, à compra, nem a pesagem ou aplicação já registradas.
export type ExitBlockerKind = "BIRTH" | "PURCHASE" | "WEIGHING" | "APPLICATION";
export type ExitBlocker = { kind: ExitBlockerKind; date: string };

export type ExitFacts = {
  birthDate?: string | null;
  purchaseDate?: string | null;
  lastWeighingDate?: string | null;
  lastApplicationDate?: string | null;
};

// Devolve o registro MAIS RECENTE que impede a saída nessa data (é o que a
// pessoa precisa corrigir), ou null se a data serve.
export function findExitConflict(exitDate: string, facts: ExitFacts): ExitBlocker | null {
  const candidates: ExitBlocker[] = [];
  const add = (kind: ExitBlockerKind, date?: string | null) => {
    if (date && date > exitDate) candidates.push({ kind, date });
  };
  add("BIRTH", facts.birthDate);
  add("PURCHASE", facts.purchaseDate);
  add("WEIGHING", facts.lastWeighingDate);
  add("APPLICATION", facts.lastApplicationDate);

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, current) => (current.date > latest.date ? current : latest));
}

// Um registro (pesagem, aplicação) pode ter esta data? (RN-ANIMAL-012, RN-PES-004)
// - nunca depois da saída;
// - nunca antes do nascimento, quando o nascimento é conhecido COM DIA.
export type DateRangeProblem = { reason: "AFTER_EXIT" | "BEFORE_BIRTH"; date: string };

export function checkDateWithinLife(
  date: string,
  animal: { exitDate?: string | null; birthDate?: string | null; birthIsExact?: boolean },
): DateRangeProblem | null {
  if (animal.exitDate && date > animal.exitDate) {
    return { reason: "AFTER_EXIT", date: animal.exitDate };
  }
  if (animal.birthIsExact && animal.birthDate && date < animal.birthDate) {
    return { reason: "BEFORE_BIRTH", date: animal.birthDate };
  }
  return null;
}
