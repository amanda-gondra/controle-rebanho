import { calendarDateOf, toDbDate } from "./dates.js";
import { ErrorCode, ruleError, type FieldError } from "./errors.js";
import type { FarmDb } from "./tenant.js";
import { recordAnimalChanges, type Actor } from "./history.js";
import { checkDateWithinLife } from "../services/exit.service.js";
import { planLotMove, type LotMoveProblem } from "../services/lot.service.js";

// Lotes (D-49): o que as rotas precisam do banco. Cada animal tem no máximo
// um período ABERTO (sem saída); mudar de lote fecha o período atual na data
// e abre outro. Tudo na linha do tempo (LOT_CHANGED) com o nome do lote.

export type LotTx = Pick<FarmDb, "lot" | "lotMembership" | "animal" | "animalEvent" | "auditLog">;

const day = (date: Date | null | undefined) => (date ? calendarDateOf(date) : null);
const lotValue = (lot: { id: string; name: string } | null) => (lot ? JSON.stringify({ lotId: lot.id, name: lot.name }) : null);

// Move animais para um lote (ou tira de qualquer lote, com `lot = null`) na
// data informada. Regras puras em services/lot.service.ts; erros por animal.
export async function moveAnimalsToLot(
  tx: LotTx,
  actor: Actor,
  lot: { id: string; name: string } | null,
  animalIds: string[],
  date: string,
) {
  const animals = await tx.animal.findMany({
    where: { id: { in: animalIds } },
    select: {
      id: true,
      tag: true,
      status: true,
      birthDate: true,
      birthPrecision: true,
      exitDate: true,
      lotMemberships: {
        where: { endDate: null },
        select: { id: true, startDate: true, lot: { select: { id: true, name: true } } },
      },
    },
  });
  if (animals.length !== animalIds.length) {
    throw ruleError(ErrorCode.ANIMALS_NOT_FOUND, "Um ou mais animais não foram encontrados.", [], 400);
  }

  const errors: FieldError[] = [];
  const plans = animals.map((animal) => {
    const open = animal.lotMemberships[0] ?? null;
    const life = checkDateWithinLife(date, {
      exitDate: day(animal.exitDate),
      birthDate: day(animal.birthDate),
      birthIsExact: animal.birthPrecision === "DAY_MONTH_YEAR",
    });
    const plan = planLotMove({
      targetLotId: lot?.id ?? null,
      date,
      active: animal.status === "ACTIVE",
      outsideLife: life !== null,
      open: open ? { lotId: open.lot.id, startDate: day(open.startDate)! } : null,
    });
    if (plan.kind === "PROBLEM") {
      errors.push(lotProblemError(animalIds.indexOf(animal.id), animal.tag, plan.problem, open ? day(open.startDate) : null));
    }
    return { animal, open, plan };
  });
  if (errors.length > 0) {
    throw ruleError(ErrorCode.LOT_MOVE_ERRORS, "Alguns animais não podem ser movidos.", errors, 422);
  }

  let moved = 0;
  for (const { animal, open, plan } of plans) {
    if (plan.kind !== "MOVE") continue;
    if (open) {
      await tx.lotMembership.update({ where: { id: open.id }, data: { endDate: toDbDate(date) } });
    }
    if (lot) {
      await tx.lotMembership.create({
        data: {
          farmId: actor.farmId,
          lotId: lot.id,
          animalId: animal.id,
          startDate: toDbDate(date),
          createdById: actor.userId,
        },
      });
    }
    await recordAnimalChanges(tx, actor, animal.id, [
      { type: "LOT_CHANGED", fromValue: lotValue(open?.lot ?? null), toValue: lotValue(lot), effectiveDate: date },
    ]);
    moved += 1;
  }
  return { moved, unchanged: animals.length - moved };
}

function lotProblemError(index: number, tag: string, problem: LotMoveProblem, openSince: string | null): FieldError {
  return {
    field: `animalIds.${index}`,
    code: problem,
    params: { tag, ...(openSince && problem === "LOT_DATE_BEFORE_CURRENT" ? { date: openSince } : {}) },
    error:
      problem === "ANIMAL_NOT_ACTIVE"
        ? `${tag} não está ativo.`
        : problem === "LOT_DATE_BEFORE_CURRENT"
          ? `${tag} entrou no lote atual depois dessa data.`
          : `${tag} não estava no rebanho nessa data.`,
  };
}

// Saída do animal (venda/morte) fecha o período aberto na data da saída;
// corrigir a data da saída move o fim; desfazer a saída reabre o período que
// a saída fechou (D-49 + D-27). Chamado na MESMA transação da mudança.
export async function syncLotWithExit(
  tx: Pick<FarmDb, "lotMembership">,
  animalId: string,
  oldExit: string | null,
  newExit: string | null,
) {
  if (oldExit === newExit) return;
  if (!oldExit && newExit) {
    await tx.lotMembership.updateMany({ where: { animalId, endDate: null }, data: { endDate: toDbDate(newExit) } });
    return;
  }
  if (oldExit && newExit) {
    await tx.lotMembership.updateMany({
      where: { animalId, endDate: toDbDate(oldExit) },
      data: { endDate: toDbDate(newExit) },
    });
    return;
  }
  // Desfez a saída: reabre o período que terminou no dia da saída (se não houver outro aberto)
  const open = await tx.lotMembership.count({ where: { animalId, endDate: null } });
  if (open > 0 || !oldExit) return;
  const closed = await tx.lotMembership.findFirst({
    where: { animalId, endDate: toDbDate(oldExit) },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (closed) await tx.lotMembership.update({ where: { id: closed.id }, data: { endDate: null } });
}

export const lotNameTaken = () => ruleError(ErrorCode.DUPLICATE_LOT_NAME, "Já existe um lote com esse nome.", [], 409);
