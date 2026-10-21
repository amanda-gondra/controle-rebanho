import { calendarDateOf } from "./dates.js";
import { ErrorCode, ruleError } from "./errors.js";
import type { FarmDb } from "./tenant.js";
import { checkDateWithinLife, findExitConflict } from "../services/exit.service.js";

// Datas da "vida" do animal no rebanho (G5 — entrega 1, D-27):
// - a saída não pode ficar antes de nascimento, compra, pesagem ou aplicação
//   já registradas (RN-ANIMAL-011);
// - pesagem e aplicação não podem ficar depois da saída nem antes do
//   nascimento com dia certo (RN-ANIMAL-012, RN-PES-004).
// As regras ficam em services/exit.service.ts (puras); aqui só se busca no
// banco o que elas precisam e se lança o erro com código.

type AnimalDates = {
  id: string;
  birthDate: Date | null;
  birthPrecision: string;
  exitDate: Date | null;
};

const day = (date: Date | null | undefined) => (date ? calendarDateOf(date) : null);

export async function assertExitDateAllowed(
  db: FarmDb,
  animal: AnimalDates,
  exitDate: string,
  field: string,
) {
  const [purchase, lastWeighing, lastApplication, lastLotMove] = await Promise.all([
    db.tradeItem.findUnique({
      where: { animalId_type: { animalId: animal.id, type: "PURCHASE" } },
      select: { trade: { select: { date: true } } },
    }),
    db.weighing.findFirst({
      where: { animalId: animal.id },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    db.applicationAnimal.findFirst({
      where: { animalId: animal.id },
      orderBy: { application: { date: "desc" } },
      select: { application: { select: { date: true } } },
    }),
    db.lotMembership.findFirst({
      where: { animalId: animal.id },
      orderBy: { startDate: "desc" },
      select: { startDate: true },
    }),
  ]);

  const blocker = findExitConflict(exitDate, {
    birthDate: day(animal.birthDate),
    purchaseDate: day(purchase?.trade.date),
    lastWeighingDate: day(lastWeighing?.date),
    lastApplicationDate: day(lastApplication?.application.date),
    lastLotMoveDate: day(lastLotMove?.startDate),
  });

  if (blocker) {
    throw ruleError(
      ErrorCode.EXIT_DATE_CONFLICT,
      "A data de saída não pode ser antes de um registro que já existe.",
      [{ field, code: ErrorCode.EXIT_DATE_CONFLICT, params: blocker, error: `Há um registro em ${blocker.date}.` }],
      422,
    );
  }
}

const lifeOf = (animal: AnimalDates) => ({
  exitDate: day(animal.exitDate),
  birthDate: day(animal.birthDate),
  birthIsExact: animal.birthPrecision === "DAY_MONTH_YEAR",
});

// Pesagem: a data tem que estar dentro da vida do animal no rebanho
export function assertWeighingDateAllowed(animal: AnimalDates, date: string) {
  const problem = checkDateWithinLife(date, lifeOf(animal));
  if (problem) {
    throw ruleError(
      ErrorCode.WEIGHING_DATE_OUT_OF_RANGE,
      problem.reason === "AFTER_EXIT"
        ? "O animal já tinha saído do rebanho nessa data."
        : "O animal ainda não tinha nascido nessa data.",
      [{ field: "date", code: ErrorCode.WEIGHING_DATE_OUT_OF_RANGE, params: problem, error: "Data fora da vida do animal." }],
      422,
    );
  }
}

// Aplicação: todos os animais precisam estar no rebanho na data
export async function assertAnimalsInHerdOnDate(db: FarmDb, animalIds: string[], date: string) {
  const animals = await db.animal.findMany({
    where: { id: { in: animalIds } },
    select: { id: true, tag: true, birthDate: true, birthPrecision: true, exitDate: true },
    orderBy: { tag: "asc" },
  });
  const outside = animals.filter((animal) => checkDateWithinLife(date, lifeOf(animal)));
  if (outside.length > 0) {
    const tags = outside.map((animal) => animal.tag).join(", ");
    throw ruleError(
      ErrorCode.ANIMALS_NOT_IN_HERD_ON_DATE,
      "Alguns animais não estavam no rebanho nessa data.",
      [
        {
          field: "animalIds",
          code: ErrorCode.ANIMALS_NOT_IN_HERD_ON_DATE,
          params: { tags, count: outside.length },
          error: `Fora do rebanho na data: ${tags}.`,
        },
      ],
      422,
    );
  }
}
