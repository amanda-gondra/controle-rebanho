import Fastify from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { animalRoutes } from "./routes/animals.routes.js";

const app = Fastify({ logger: true });

app.get("/health", async () => {
  return { status: "ok" };
});

app.register(animalRoutes);

// Central error handler: one place decides the response for each kind of error.
app.setErrorHandler((error, request, reply) => {
  // Validation error (Zod) → 400
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Invalid data.",
      errors: error.issues.map((i) => ({
        field: i.path.join("."),
        error: i.message,
      })),
    });
  }

  // Duplicate tag (Prisma P2002) → 409
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return reply.status(409).send({
      message: "An animal with this tag already exists.",
    });
  }

  // Anything else → log internally, respond generically (never leak internals)
  request.log.error(error);
  return reply.status(500).send({ message: "Internal server error." });
});

app.listen({ port: 3333 }).then(() => {
  console.log("🚀 Server running at http://localhost:3333");
});