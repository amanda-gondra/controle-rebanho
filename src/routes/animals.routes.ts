import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import {
  createAnimalSchema,
  animalIdParamSchema,
  listAnimalsQuerySchema,
  updateStatusSchema,
  updateAnimalSchema,
} from "../schemas/animal.schema.js";
import {
   createWeighingSchema } from "../schemas/weighing.schema.js";
import {
   calculateWeightGain } from "../services/weighing.service.js";

export async function animalRoutes(app: FastifyInstance) {
  // POST /animals — register a new animal
  app.post("/animals", async (request, reply) => {
    const data = createAnimalSchema.parse(request.body);
    const animal = await prisma.animal.create({ data });
    return reply.status(201).send(animal);
  });

  // GET /animals — list animals, with optional filters
  app.get("/animals", async (request) => {
    const { status, category } = listAnimalsQuerySchema.parse(request.query);

    const animals = await prisma.animal.findMany({
      where: { status, category },
      orderBy: { createdAt: "desc" },
    });

    return animals;
  });

  // GET /animals/:id — get one animal by id
  app.get("/animals/:id", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);

    const animal = await prisma.animal.findUnique({ where: { id } });

    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    return animal;
  });

  // PATCH /animals/:id/status — change an animal's status
  app.patch("/animals/:id/status", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);
    const { status } = updateStatusSchema.parse(request.body);

    // confere se o animal existe antes de tentar atualizar
    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    // atualiza só o status
    const updated = await prisma.animal.update({
      where: { id },
      data: { status },
    });

    return updated;
  });

  // PUT /animals/:id — update an animal's data
  app.put("/animals/:id", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);
    const data = updateAnimalSchema.parse(request.body);

    // confere se existe antes de atualizar
    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    const updated = await prisma.animal.update({
      where: { id },
      data,
    });

    return updated;
  });

  // POST /animals/:id/pesagens — register a weighing for an animal
  app.post("/animals/:id/pesagens", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);
    const data = createWeighingSchema.parse(request.body);

    // confere se o animal existe antes de registrar a pesagem
    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    // cria a pesagem já ligada a esse animal
    const weighing = await prisma.weighing.create({
      data: {
        date: data.date,
        weightKg: data.weightKg,
        animalId: id,
      },
    });

    return reply.status(201).send(weighing);
  });

  // GET /animals/:id/pesagens — list an animal's weighings (newest first)
  app.get("/animals/:id/pesagens", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);

    // confere se o animal existe
    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    // busca as pesagens desse animal, da mais recente pra mais antiga
    const weighings = await prisma.weighing.findMany({
      where: { animalId: id },
      orderBy: { date: "desc" },
    });

    return weighings;
  });

  // GET /animals/:id/ganho-peso — weight gain and average daily gain (ADG)
  app.get("/animals/:id/ganho-peso", async (request, reply) => {
    const { id } = animalIdParamSchema.parse(request.params);

    // confere se o animal existe
    const animal = await prisma.animal.findUnique({ where: { id } });
    if (!animal) {
      return reply.status(404).send({ message: "Animal not found." });
    }

    // chama o serviço que faz o cálculo
    const result = await calculateWeightGain(id);

    // se não deu pra calcular (menos de 2 pesagens), responde claro
    if (!result) {
      return reply.status(422).send({
        message: "At least two weighings are required to calculate weight gain.",
      });
    }

    return result;
  });
}