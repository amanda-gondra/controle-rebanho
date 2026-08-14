import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { createAnimalSchema } from "../schemas/animal.schema.js";

export async function animalRoutes(app: FastifyInstance) {
  // POST /animals — register a new animal
  app.post("/animals", async (request, reply) => {
    const data = createAnimalSchema.parse(request.body);
    const animal = await prisma.animal.create({ data });
    return reply.status(201).send(animal);
  });

  // GET /animals — list all animals (newest first)
  app.get("/animals", async () => {
    const animals = await prisma.animal.findMany({
      orderBy: { createdAt: "desc" },
    });
    return animals;
  });
}