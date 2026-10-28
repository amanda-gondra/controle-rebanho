import { calendarDateOf, todayInTimeZone } from "./dates.js";
import { ErrorCode, conflict } from "./errors.js";
import type { FarmDb } from "./tenant.js";
import type { AnimalChange, AnimalSnapshot } from "../services/animal-history.service.js";

// Histórico e autoria (D-28, D-51): o que as rotas precisam do banco para
// gravar a linha do tempo do animal e a trilha de ações sensíveis.
// Sempre chamado DENTRO da mesma transação da mudança: ou grava os dois, ou
// nenhum (Espec — Animais §8).

export type HistoryTx = Pick<FarmDb, "animalEvent" | "auditLog">;

// Quem e onde: sempre da sessão, nunca do navegador
export type Actor = { farmId: string; userId: string; timezone: string };

export const actorOf = (auth: { user: { id: string }; farm: { id: string; timezone: string } }): Actor => ({
  farmId: auth.farm.id,
  userId: auth.user.id,
  timezone: auth.farm.timezone,
});

const day = (date: Date | null | undefined) => (date ? calendarDateOf(date) : null);

// Animal do banco → o que conta para a história
export function snapshotOf(animal: {
  tag: string;
  sex: string;
  category: string;
  birthPrecision: string;
  birthDate: Date | null;
  status: string;
  exitDate: Date | null;
  deathCause: string | null;
  deathCauseCertainty: string | null;
  origin: string;
  entryDate: Date | null;
}): AnimalSnapshot {
  return {
    tag: animal.tag,
    sex: animal.sex,
    category: animal.category,
    birthPrecision: animal.birthPrecision,
    birthDate: day(animal.birthDate),
    status: animal.status,
    exitDate: day(animal.exitDate),
    deathCause: animal.deathCause,
    deathCauseCertainty: animal.deathCauseCertainty,
    origin: animal.origin,
    entryDate: day(animal.entryDate),
  };
}

// Data em que a mudança vale: a informada (troca de brinco, saída) ou hoje
// no fuso da fazenda
export async function recordAnimalChanges(
  tx: HistoryTx,
  actor: Actor,
  animalId: string,
  changes: (AnimalChange & { effectiveDate?: string | null; reason?: "LOST" | "DAMAGED" | "TYPO" | "OTHER" })[],
) {
  if (changes.length === 0) return;
  const today = todayInTimeZone(actor.timezone);
  await tx.animalEvent.createMany({
    data: changes.map((change) => ({
      farmId: actor.farmId,
      animalId,
      userId: actor.userId,
      type: change.type,
      fromValue: change.fromValue,
      toValue: change.toValue,
      reason: change.reason ?? null,
      effectiveDate: new Date(`${change.effectiveDate ?? today}T00:00:00.000Z`),
    })),
  });
}

// ── Trilha de ações sensíveis (D-51/D-54) ──
// Só o necessário para responder "quem, quando, o quê, em qual registro".
export const AuditAction = {
  ANIMAL_DELETED: "ANIMAL_DELETED",
  WEIGHING_DELETED: "WEIGHING_DELETED",
  APPLICATION_DELETED: "APPLICATION_DELETED",
  PRODUCT_ARCHIVED: "PRODUCT_ARCHIVED",
  PRODUCT_RESTORED: "PRODUCT_RESTORED",
  TRADE_UNDONE: "TRADE_UNDONE",
  TRADE_ITEM_REMOVED: "TRADE_ITEM_REMOVED",
  FARM_SETTINGS_CHANGED: "FARM_SETTINGS_CHANGED",
  LOT_DELETED: "LOT_DELETED",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export async function recordAudit(
  tx: HistoryTx,
  actor: Actor,
  entry: { action: AuditAction; entityType: string; entityId: string; details?: Record<string, unknown> },
) {
  await tx.auditLog.create({
    data: {
      farmId: actor.farmId,
      userId: actor.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: (entry.details ?? {}) as object,
    },
  });
}

// ── Brinco sem diferenciar maiúsculas (D-29, RN-ANIMAL-003) ──
// O índice único (farmId, lower(tag)) garante no banco; esta conferência dá o
// erro certo antes (e com o campo). `exceptId`: o próprio animal (troca de brinco).
export async function assertTagAvailable(
  db: Pick<FarmDb, "animal">,
  tag: string,
  exceptId?: string,
) {
  const taken = await db.animal.findFirst({
    where: { tag: { equals: tag, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (taken) throw duplicateTag();
}

export const duplicateTag = () =>
  conflict(ErrorCode.DUPLICATE_TAG, "Já existe um animal cadastrado com este brinco.");
