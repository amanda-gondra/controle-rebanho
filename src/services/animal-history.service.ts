// Linha do tempo do animal (D-28, RN-ANIMAL-017) — regras puras, testadas em
// animal-history.service.test.ts.
//
// Cada mudança vira um evento com o valor ANTES e DEPOIS em texto estável:
// - brinco, categoria e sexo: o próprio código ("BR-104", "YEARLING", "MALE");
// - nascimento, situação e origem: JSON pequeno com códigos e datas ISO
//   ({"precision":"MONTH_YEAR","date":"2026-03-01"}).
// A tela traduz; o banco nunca guarda texto em português.

export type AnimalEventType =
  | "TAG_CHANGED"
  | "CATEGORY_CHANGED"
  | "SEX_CHANGED"
  | "BIRTH_CHANGED"
  | "STATUS_CHANGED"
  | "ORIGIN_CHANGED"
  | "LOT_CHANGED";

export type AnimalChange = {
  type: AnimalEventType;
  fromValue: string | null;
  toValue: string | null;
};

// O que importa para a história (datas já como "AAAA-MM-DD" ou null)
export type AnimalSnapshot = {
  tag: string;
  sex: string;
  category: string;
  birthPrecision: string;
  birthDate: string | null;
  status: string;
  exitDate: string | null;
  deathCause: string | null;
  deathCauseCertainty: string | null;
  origin: string;
  entryDate: string | null;
};

export const birthValue = (precision: string, date: string | null) =>
  JSON.stringify(precision === "UNKNOWN" || !date ? { precision: "UNKNOWN" } : { precision, date });

export function statusValue(snapshot: Pick<AnimalSnapshot, "status" | "exitDate" | "deathCause" | "deathCauseCertainty">) {
  if (snapshot.status === "ACTIVE") return JSON.stringify({ status: "ACTIVE" });
  return JSON.stringify({
    status: snapshot.status,
    exitDate: snapshot.exitDate,
    ...(snapshot.status === "DEAD"
      ? { certainty: snapshot.deathCauseCertainty ?? "NOT_INFORMED", cause: snapshot.deathCause ?? null }
      : {}),
  });
}

export const originValue = (origin: string, entryDate: string | null) =>
  JSON.stringify(entryDate ? { origin, entryDate } : { origin });

// O que mudou entre duas versões do animal, na ordem em que aparece na tela.
// Mudança que não muda nada (mesmo valor) não vira evento.
export function diffAnimal(before: AnimalSnapshot, after: AnimalSnapshot): AnimalChange[] {
  const changes: AnimalChange[] = [];
  const add = (type: AnimalEventType, fromValue: string, toValue: string) => {
    if (fromValue !== toValue) changes.push({ type, fromValue, toValue });
  };
  add("TAG_CHANGED", before.tag, after.tag);
  add("SEX_CHANGED", before.sex, after.sex);
  add("CATEGORY_CHANGED", before.category, after.category);
  add(
    "BIRTH_CHANGED",
    birthValue(before.birthPrecision, before.birthDate),
    birthValue(after.birthPrecision, after.birthDate),
  );
  add("STATUS_CHANGED", statusValue(before), statusValue(after));
  add("ORIGIN_CHANGED", originValue(before.origin, before.entryDate), originValue(after.origin, after.entryDate));
  return changes;
}

// Entrada na fazenda (D-52): não antes do nascimento com dia certo, nem
// depois da saída. "Futuro" é conferido na rota (fuso da fazenda).
export type EntryDateProblem = { reason: "BEFORE_BIRTH" | "AFTER_EXIT"; date: string };

export function checkEntryDate(
  entryDate: string | null,
  animal: { birthDate: string | null; birthPrecision: string; exitDate: string | null },
): EntryDateProblem | null {
  if (!entryDate) return null;
  if (animal.birthPrecision === "DAY_MONTH_YEAR" && animal.birthDate && entryDate < animal.birthDate) {
    return { reason: "BEFORE_BIRTH", date: animal.birthDate };
  }
  if (animal.exitDate && entryDate > animal.exitDate) {
    return { reason: "AFTER_EXIT", date: animal.exitDate };
  }
  return null;
}
