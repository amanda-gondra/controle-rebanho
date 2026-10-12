import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { toDbDate } from "../lib/dates.js";
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

const animalNotFound = () =>
  notFound(ErrorCode.ANIMAL_NOT_FOUND, "Animal não encontrado.");

const weighingNotFound = () =>
  notFound(ErrorCode.WEIGHING_NOT_FOUND, "Pesagem não encontrada.");

// Garante que o animal existe; senão, 404.
async function findAnimalOrFail(id: string) {
  const animal = await prisma.animal.findUnique({ where: { id } });
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
      const { birthDate, ...rest } = request.body;
      const animal = await prisma.animal.create({
        data: {
          ...rest,
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
      const animals = await prisma.animal.findMany({
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
    async (request) => findAnimalOrFail(request.params.id),
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
      await findAnimalOrFail(request.params.id);

      const { birthDate, birthPrecision, ...rest } = request.body;
      return prisma.animal.update({
        where: { id: request.params.id },
        data: {
          ...rest,
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
      const { count } = await prisma.animal.deleteMany({
        where: { id, purchase: { is: null }, sale: { is: null } },
      });

      if (count === 0) {
        // Não apagou: ou não existe, ou tem histórico financeiro.
        await findAnimalOrFail(id);
        throw conflict(
          ErrorCode.ANIMAL_HAS_TRANSACTIONS,
          "Este animal tem compra ou venda registrada e não pode ser excluído.",
        );
      }

      return reply.status(204).send();
    },
  );

  // PATCH /animals/:id/status
  // D-06: animal com venda registrada fica "vendido"; para mudar, desfaça a venda.
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
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
        include: { sale: { select: { id: true } } },
      });
      if (!animal) throw animalNotFound();

      if (animal.sale && request.body.status !== "SOLD") {
        throw conflict(
          ErrorCode.ANIMAL_HAS_SALE,
          "Este animal tem uma venda registrada. Para mudar o status, desfaça a venda.",
        );
      }

      return prisma.animal.update({
        where: { id: request.params.id },
        data: { status: request.body.status },
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
      await findAnimalOrFail(request.params.id);
      const weighing = await prisma.weighing.create({
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
          animalId: request.params.id,
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
      await findAnimalOrFail(request.params.id);
      return prisma.weighing.findMany({
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
      // a pesagem tem que existir E pertencer a este animal
      const { count } = await prisma.weighing.updateMany({
        where: { id: request.params.weighingId, animalId: request.params.id },
        data: {
          date: toDbDate(request.body.date),
          weightKg: request.body.weightKg,
        },
      });
      if (count === 0) throw weighingNotFound();

      return prisma.weighing.findUniqueOrThrow({
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
      // a pesagem tem que existir E pertencer a este animal
      const { count } = await prisma.weighing.deleteMany({
        where: { id: request.params.weighingId, animalId: request.params.id },
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
      await findAnimalOrFail(request.params.id);
      const outcome = await calculateWeightGain(request.params.id);

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
