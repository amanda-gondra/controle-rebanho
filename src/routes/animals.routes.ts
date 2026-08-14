import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import {
  createAnimalSchema,
  animalIdParamSchema,
  listAnimalsQuerySchema,
} from "../schemas/animal.schema.js";

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
}