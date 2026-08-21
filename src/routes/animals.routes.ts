import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import {
  createAnimalSchema,
  animalIdParamSchema,
  listAnimalsQuerySchema,
  updateStatusSchema,
  updateAnimalSchema,
} from "../schemas/animal.schema.js";
import { createWeighingSchema } from "../schemas/weighing.schema.js";
import { calculateWeightGain } from "../services/weighing.service.js";

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
          ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
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
        summary: "Lista os animais (com filtros)",
        querystring: listAnimalsQuerySchema,
      },
    },
    async (request) => {
      const { status, category } = request.query;
      const animals = await prisma.animal.findMany({
        where: { status, category },
        orderBy: { createdAt: "desc" },
        include: {
          weighings: { orderBy: { date: "desc" }, take: 1 },
        },
      });

      return animals.map(({ weighings, ...animal }) => ({
        ...animal,
        currentWeightKg: weighings[0] ? Number(weighings[0].weightKg) : null,
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
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      return animal;
    },
  );

  // PUT /animals/:id
  r.put(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Edita os dados de um animal",
        params: animalIdParamSchema,
        body: updateAnimalSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      const { birthDate, ...rest } = request.body;
      const updated = await prisma.animal.update({
        where: { id: request.params.id },
        data: {
          ...rest,
          ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
        },
      });
      return updated;
    },
  );

  // DELETE /animals/:id
  r.delete(
    "/animals/:id",
    {
      schema: {
        tags: ["Animais"],
        summary: "Exclui um animal (e as pesagens dele)",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      // apaga as pesagens primeiro (são "filhas" do animal), depois o animal
      await prisma.weighing.deleteMany({
        where: { animalId: request.params.id },
      });
      await prisma.animal.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    },
  );

  // PATCH /animals/:id/status
  r.patch(
    "/animals/:id/status",
    {
      schema: {
        tags: ["Animais"],
        summary: "Muda o status (vendido/morto)",
        params: animalIdParamSchema,
        body: updateStatusSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      const updated = await prisma.animal.update({
        where: { id: request.params.id },
        data: { status: request.body.status },
      });
      return updated;
    },
  );

  // POST /animals/:id/pesagens
  r.post(
    "/animals/:id/pesagens",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Registra uma pesagem",
        params: animalIdParamSchema,
        body: createWeighingSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      const weighing = await prisma.weighing.create({
        data: {
          date: new Date(request.body.date),
          weightKg: request.body.weightKg,
          animalId: request.params.id,
        },
      });
      return reply.status(201).send(weighing);
    },
  );

  // GET /animals/:id/pesagens
  r.get(
    "/animals/:id/pesagens",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Histórico de pesagens do animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      return prisma.weighing.findMany({
        where: { animalId: request.params.id },
        orderBy: { date: "desc" },
      });
    },
  );

  // GET /animals/:id/ganho-peso
  r.get(
    "/animals/:id/ganho-peso",
    {
      schema: {
        tags: ["Pesagens"],
        summary: "Ganho de peso e GMD do animal",
        params: animalIdParamSchema,
      },
    },
    async (request, reply) => {
      const animal = await prisma.animal.findUnique({
        where: { id: request.params.id },
      });
      if (!animal) {
        return reply.status(404).send({ message: "Animal not found." });
      }
      const result = await calculateWeightGain(request.params.id);
      if (!result) {
        return reply.status(422).send({
          message:
            "At least two weighings are required to calculate weight gain.",
        });
      }
      return result;
    },
  );
}