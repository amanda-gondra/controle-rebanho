import Fastify from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  hasZodFastifySchemaValidationErrors,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { animalRoutes } from "./routes/animals.routes.js";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// Zod como fonte única: valida as requisições E alimenta a documentação
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Segurança: cabeçalhos de proteção
await app.register(helmet);

// Segurança: limite de requisições (100 por minuto por IP)
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Libera o acesso do frontend (CORS)
await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

// Documentação (Swagger / OpenAPI) — registrada ANTES das rotas
await app.register(swagger, {
  openapi: {
    info: {
      title: "Controle de Rebanho API",
      description: "API para controle de um rebanho de gado de corte.",
      version: "1.0.0",
    },
  },
  transform: jsonSchemaTransform,
});

await app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => {
  return { status: "ok" };
});

app.register(animalRoutes);

// Tratador de erros central
app.setErrorHandler((error, request, reply) => {
  // Validação automática (schemas Zod nas rotas) → 400
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      message: "Invalid data.",
      errors: error.validation.map((issue: any) => ({
        field: issue.instancePath ? issue.instancePath.replace(/^\//, "") : "",
        error: issue.message,
      })),
    });
  }

  // Validação manual (.parse) — rede de segurança
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Invalid data.",
      errors: error.issues.map((i) => ({
        field: i.path.join("."),
        error: i.message,
      })),
    });
  }

  // Brinco duplicado (Prisma P2002) → 409
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return reply.status(409).send({
      message: "An animal with this tag already exists.",
    });
  }

  request.log.error(error);
  return reply.status(500).send({ message: "Internal server error." });
});

app.listen({ port: 3333 }).then(() => {
  console.log("🚀 Server running at http://localhost:3333");
});