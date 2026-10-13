import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { assertNotInFuture, toDbDate } from "../lib/dates.js";
import type { FarmDb } from "../lib/tenant.js";
import {
  ErrorCode,
  conflict,
  notFound,
  unprocessable,
} from "../lib/errors.js";
import {
  createAnimalSchema,
  animalIdParamSchema,
  listAnimalsQuerySchema,
  updateStatusSchema,
  updateAnimalSchema,
} from "../schemas/animal.schema.js";
import {
  weighingBodySchema,
  weighingParamsSchema,
} from "../schemas/weighing.schema.js";
import { calculateWeightGain } from "../services/weighing.service.js";
import { resolveAnimalProfile } from "../services/animal.service.js";
import { assertExitDateAllowed, assertWeighingDateAllowed } from "../lib/animal-life.js";
import { fieldError } from "../lib/errors.js";

const animalNotFound = () =>
  notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");

const weighingNotFound = () =>
  notFound(ErrorCode.WEIGHING_NOT_FOUND, "Pesagem não encontrada.");

const FUTURE_BIRTH = "A data de nascimento não pode ser no futuro.";
const FUTURE_WEIGHING = "A data da pesagem não pode ser no futuro.";

// Pesagem criada por compra/venda só muda pela negociação (RN-PES-009, D-08)
function assertNotFromTrade(source: string) {
  if (source !== "MANUAL") {
    throw conflict(
      ErrorCode.WEIGHING_FROM_TRADE,
      "Esta pesagem veio de uma compra ou venda. Para mudar, corrija a negociação.",
    );
  }
}

// Garante que o animal existe NESTA fazenda; senão, 404.
async function findAnimalOrFail(db: FarmDb, id: string) {
  const animal = await db.animal.findUnique({ where: { id } });
  if (!animal) throw animalNotFound();
  return animal;
}

export async function animalRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /animals
  r.post(
    "/animals",
    {
      schema: {
        tags: ["Animais"],
        summary: "Cadastra um novo animal",
        body: createAnimalSchema,
      },
    },
    async (request, reply) => {
      const { birthDate, sex, category, castrated, ...rest } = request.body;
      assertNotInFuture(birthDate, request.auth.farm.timezone, "birthDate", FUTURE_BIRTH);
      // Categoria × sexo e castrado (G4); castrado padrão vem da fazenda
      const profile = resolveAnimalProfile(
        null,
        { sex, category, castrated },
        request.auth.farm.settings.defaultCastrated,
      );
      const animal = await request.db.animal.create({
        data: {
          ...rest,
          ...profile,
          farmId: request.auth.farm.id,
          ...(birthDate ? { birthDate: toDbDate(birthDate) } : {}),
        },
      });
      return reply.status(201).send(animal);
    },
  );

  // GET /animals
  r.get(
    "/animals",
    {
      schema: {
        tags: ["Animais"],
        summary: "Lista os animais (com filtros e ordenação)",
        querystring: listAnimalsQuerySchema,
      },
    },
    async (request) => {
      const { status, category, sortBy, order } = request.query;
      const animals = await request.db.animal.findMany({
        where: { status, category },
        orderBy: { [sortBy]: order },
        include: {
          weighings: { orderBy: { date: "desc" }, take: 1 },
        },
      });

      return animals.map(({ weighings, ...animal }) => ({
        ...animal,
        currentWeightKg: weighings[0] ? Number(weighings[0].weightKg) : null,
        lastWeighingDate: weighings[0] ? weighings[0].date : null,
      }));
    },
  );

  // GET /animals/:id
  r.get(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Busca um animal pelo id",
        params: animalIdParamSchema,
      },
    },
    async (request) => findAnimalOrFail(request.db, request.params.id),
  );

  // PUT /animals/:id
  r.put(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Edita os dados de um animal (null limpa raça, nascimento e observações)",
        params: animalIdParamSchema,
        body: updateAnimalSchema,
      },
    },
    async (request) => {
      const current = await findAnimalOrFail(request.db, request.params.id);

      const { birthDate, birthPrecision, sex, category, castrated, ...rest } = request.body;
      assertNotInFuture(birthDate, request.auth.farm.timezone, "birthDate", FUTURE_BIRTH);
      // Confere a combinação FINAL (o que já tinha + o que mudou): corrigir o
      // sexo de um garrote para fêmea sem trocar a categoria é recusado.
      const profile = resolveAnimalProfile(
        current,
        { sex, category, castrated },
        request.auth.farm.settings.defaultCastrated,
      );
      return request.db.animal.update({
        where: { id: request.params.id },
        data: {
          ...rest,
          ...profile,
          ...(birthDate !== undefined
            ? { birthDate: birthDate === null ? null : toDbDate(birthDate) }
            : {}),
          // Sem data de nascimento, a precisão volta a "desconhecida"
          ...(birthDate === null
            ? { birthPrecision: "UNKNOWN" as const }
            : birthPrecision !== undefined
              ? { birthPrecision }
              : {}),
        },
      });
    },
  );

  // DELETE /animals/:id
  // D-10: animal com compra ou venda NÃO pode ser excluído (o histórico
  // financeiro não some). Sem transação, a exclusão leva junto pesagens e
  // participações em aplicações (cascata do banco, num passo só — F-22).
  r.delete(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Exclui um animal sem compra nem venda (e as pesagens dele)",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Uma instrução só: apaga apenas se não houver compra nem venda.
      const { count } = await request.db.animal.deleteMany({
        where: { id, purchase: { is: null }, sale: { is: null } },
      });

      if (count === 0) {
        // Não apagou: ou não existe, ou tem histórico financeiro.
        await findAnimalOrFail(request.db, id);
        throw conflict(
          ErrorCode.ANIMAL_HAS_TRANSACTIONS,
          "Este animal tem compra ou venda registrada e não pode ser excluído.",
        );
      }

      return reply.status(204).send();
    },
  );

  // PATCH /animals/:id/status — muda a situação e registra a SAÍDA (D-27)
  // - ativo ⇄ morto; ativo ⇄ vendido (sem venda registrada). Morto ⇄ vendido
  //   direto não: volte para ativo antes (RN-ANIMAL-010).
  // - Mesma situação de novo = corrigir a data/causa da saída.
  // - D-06: animal com venda registrada fica "vendido"; para mudar, desfaça a venda.
  r.patch(
    "/animals/:id/status",
    {
      schema: {
        tags: ["Animais"],
        summary: "Muda o status (ativo/vendido/morto)",
        params: animalIdParamSchema,
        body: updateStatusSchema,
      },
    },
    async (request) => {
      const animal = await request.db.animal.findUnique({
        where: { id: request.params.id },
        include: { sale: { select: { id: true } } },
      });
      if (!animal) throw animalNotFound();

      const { status, exitDate, deathCause, deathCauseCertainty } = request.body;

      // Com venda registrada, a saída é a da venda: só "Desfazer venda" muda
      if (animal.sale) {
        throw conflict(
          ErrorCode.ANIMAL_HAS_SALE,
          "Este animal tem uma venda registrada. Para mudar o status, desfaça a venda.",
        );
      }

      // Voltar para ativo (ex.: morte registrada por engano): apaga a saída
      if (status === "ACTIVE") {
        return request.db.animal.update({
          where: { id: animal.id },
          data: { status, exitDate: null, deathCause: null, deathCauseCertainty: null },
        });
      }

      // Morto ⇄ vendido direto não existe na vida real; passa por ativo
      if (animal.status !== "ACTIVE" && animal.status !== status) {
        throw conflict(
          ErrorCode.INVALID_STATUS_TRANSITION,
          "Para mudar de morto para vendido (ou o contrário), volte o animal para ativo antes.",
        );
      }

      if (!exitDate) {
        throw fieldError("exitDate", "REQUIRED", "Informe a data de saída.");
      }
      assertNotInFuture(exitDate, request.auth.farm.timezone, "exitDate", "A data de saída não pode ser no futuro.");
      await assertExitDateAllowed(request.db, animal, exitDate, "exitDate");

      return request.db.animal.update({
        where: { id: animal.id },
        data: {
          status,
          exitDate: toDbDate(exitDate),
          // causa e certeza só existem na morte
          deathCause: status === "DEAD" ? deathCause || null : null,
          deathCauseCertainty: status === "DEAD" ? (deathCauseCertainty ?? "NOT_INFORMED") : null,
        },
      });
    },
  );

  // POST /animals/:id/weighings
  r.post(
    "/animals/:id/weighings",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Registra uma pesagem",
        params: animalIdParamSchema,
        body: weighingBodySchema,
      },
    },
    async (request, reply) => {
      const animal = await findAnimalOrFail(request.db, request.params.id);
      assertNotInFuture(request.body.date, request.auth.farm.timezone, "date", FUTURE_WEIGHING);
      // Nada depois da saída nem antes do nascimento (RN-ANIMAL-012, RN-PES-004).
      // Mesmo dia de outra pesagem → o banco recusa (DUPLICATE_WEIGHING_DATE, D-33).
      assertWeighingDateAllowed(animal, request.body.date);
      const weighing = await request.db.weighing.create({
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
          animalId: request.params.id,
          farmId: request.auth.farm.id,
        },
      });
      return reply.status(201).send(weighing);
    },
  );

  // GET /animals/:id/weighings
  r.get(
    "/animals/:id/weighings",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Histórico de pesagens do animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      await findAnimalOrFail(request.db, request.params.id);
      return request.db.weighing.findMany({
        where: { animalId: request.params.id },
        orderBy: { date: "desc" },
      });
    },
  );

  // PUT /animals/:id/weighings/:weighingId — edita uma pesagem
  r.put(
    "/animals/:id/weighings/:weighingId",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Edita uma pesagem",
        params: weighingParamsSchema,
        body: weighingBodySchema,
      },
    },
    async (request) => {
      assertNotInFuture(request.body.date, request.auth.farm.timezone, "date", FUTURE_WEIGHING);
      const animal = await findAnimalOrFail(request.db, request.params.id);
      const existing = await request.db.weighing.findFirst({
        where: { id: request.params.weighingId, animalId: request.params.id },
        select: { source: true },
      });
      if (!existing) throw weighingNotFound();
      assertNotFromTrade(existing.source);
      assertWeighingDateAllowed(animal, request.body.date);

      // a pesagem tem que existir E pertencer a este animal (e a esta fazenda)
      const { count } = await request.db.weighing.updateMany({
        where: { id: request.params.weighingId, animalId: request.params.id },
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
        },
      });
      if (count === 0) throw weighingNotFound();

      return request.db.weighing.findUniqueOrThrow({
        where: { id: request.params.weighingId },
      });
    },
  );

  // DELETE /animals/:id/weighings/:weighingId — exclui uma pesagem
  r.delete(
    "/animals/:id/weighings/:weighingId",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Exclui uma pesagem",
        params: weighingParamsSchema,
      },
    },
    async (request, reply) => {
      const existing = await request.db.weighing.findFirst({
        where: { id: request.params.weighingId, animalId: request.params.id },
        select: { source: true },
      });
      if (!existing) throw weighingNotFound();
      assertNotFromTrade(existing.source);

      // a pesagem tem que existir E pertencer a este animal (e a esta fazenda);
      // só apaga se continuar sendo manual (numa instrução só)
      const { count } = await request.db.weighing.deleteMany({
        where: { id: request.params.weighingId, animalId: request.params.id, source: "MANUAL" },
      });
      if (count === 0) throw weighingNotFound();
      return reply.status(204).send();
    },
  );

  // GET /animals/:id/weight-gain
  r.get(
    "/animals/:id/weight-gain",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Ganho de peso e GMD do animal",
        params: animalIdParamSchema,
      },
    },
    async (request) => {
      await findAnimalOrFail(request.db, request.params.id);
      const outcome = await calculateWeightGain(request.db, request.params.id);

      if (!outcome.ok) {
        throw outcome.reason === "SAME_DAY_WEIGHINGS"
          ? unprocessable(
              ErrorCode.SAME_DAY_WEIGHINGS,
              "A primeira e a última pesagem são do mesmo dia. Registre uma pesagem em outra data para calcular o ganho de peso.",
            )
          : unprocessable(
              ErrorCode.INSUFFICIENT_WEIGHINGS,
              "São necessárias pelo menos duas pesagens para calcular o ganho de peso.",
            );
      }

      return outcome.value;
    },
  );
}
