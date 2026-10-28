import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { AppConfig } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./lib/error-handler.js";
import { ErrorCode } from "./lib/errors.js";
import { authenticate } from "./lib/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { animalRoutes } from "./routes/animals.routes.js";
import { sanitaryRoutes } from "./routes/sanitary.routes.js";
import { financeRoutes } from "./routes/finance.routes.js";
import { tradeRoutes } from "./routes/trades.routes.js";
import { farmRoutes } from "./routes/farm.routes.js";
import { lotRoutes } from "./routes/lots.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";

// Monta a aplicação SEM subir o servidor. Assim os testes conseguem criar a
// API, fazer requisições com app.inject() e fechar, sem abrir porta de rede.
// Quem sobe o servidor de verdade é o server.ts.
export async function buildApp(config: AppConfig) {
  const app = Fastify({
    logger:
      config.logLevel === "silent"
        ? false
        : {
            level: config.logLevel,
            // Nunca grava credenciais nos logs (a G1 trará cookie de sessão)
            redact: ["req.headers.authorization", "req.headers.cookie"],
          },
  }).withTypeProvider<ZodTypeProvider>();

  // Zod como fonte única: valida as requisições E alimenta a documentação
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Tratamento de erros central. Precisa vir ANTES de registrar plugins e
  // rotas: cada plugin "herda" o tratador que existe no momento do registro.
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({
      code: ErrorCode.ROUTE_NOT_FOUND,
      message: "Rota não encontrada.",
    }),
  );

  // Segurança: cabeçalhos de proteção
  await app.register(helmet);

  // Segurança: limite de requisições por IP
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: "1 minute",
  });

  // CORS: só as origens configuradas (antes: qualquer origem — F-20).
  // `credentials: true` deixa o navegador mandar o cookie de sessão — por isso
  // a lista de origens precisa ser fechada (nunca "qualquer origem").
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Leitura e escrita de cookies (sessão de login — D-23)
  await app.register(cookie);
  app.decorateRequest("auth", null as never);
  app.decorateRequest("db", null as never);

  // Documentação (Swagger / OpenAPI) — desligada em produção por padrão
  if (config.apiDocsEnabled) {
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
  }

  // Liveness: o processo está de pé?
  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok" }));

  // Readiness: o banco responde? (usado pela hospedagem antes de mandar tráfego)
  app.get("/ready", { schema: { hide: true } }, async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  // Rotas públicas da conta (criar conta, entrar, sair)
  await app.register(async (instance) => authRoutes(instance, config));

  // Rotas PROTEGIDAS: tudo aqui dentro exige sessão válida e enxerga só os
  // dados da fazenda logada (request.db).
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", authenticate(config.cookieSecure));
    await protectedApp.register(animalRoutes);
    await protectedApp.register(sanitaryRoutes);
    await protectedApp.register(financeRoutes);
    await protectedApp.register(tradeRoutes);
    await protectedApp.register(farmRoutes);
    await protectedApp.register(lotRoutes);
    await protectedApp.register(dashboardRoutes);
  });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
