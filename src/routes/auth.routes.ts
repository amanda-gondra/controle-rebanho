import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { AppConfig } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ErrorCode, conflict, unauthorized } from "../lib/errors.js";
import { getDummyHash, hashPassword, verifyPassword } from "../lib/password.js";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  setSessionCookie,
} from "../lib/session.js";
import { authenticate } from "../lib/auth.js";
import { FARM_SELECT, toFarmView } from "../lib/farm.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

// O que a API devolve sobre a conta (nunca o hash da senha).
const accountSelect = {
  id: true,
  name: true,
  email: true,
  farm: { select: FARM_SELECT },
} as const satisfies Prisma.UserSelect;

type Account = Prisma.UserGetPayload<{ select: typeof accountSelect }>;

// Mesmo formato de GET /auth/me: { user, farm } (farm com as configurações)
const toResponse = ({ farm, ...user }: Account) => ({ user, farm: toFarmView(farm) });

export async function authRoutes(app: FastifyInstance, config: AppConfig) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Limite mais apertado nas rotas de senha (força bruta), por IP
  const authRateLimit = {
    rateLimit: { max: config.authRateLimitMax, timeWindow: "1 minute" },
  };

  // POST /auth/register — cria a conta: fazenda + usuário, juntos
  r.post(
    "/auth/register",
    {
      config: authRateLimit,
      schema: {
        tags: ["Conta"],
        summary: "Cria a conta (fazenda + usuário) e já entra",
        body: registerSchema,
      },
    },
    async (request, reply) => {
      const { farmName, name, email, password } = request.body;

      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        throw conflict(ErrorCode.EMAIL_ALREADY_REGISTERED, "Já existe uma conta com esse e-mail.");
      }

      const passwordHash = await hashPassword(password);

      // Uma instrução só: a fazenda e o usuário são criados juntos ou nenhum dos
      // dois (se o e-mail for usado ao mesmo tempo por outra pessoa, a
      // unicidade do banco barra e nada fica gravado).
      const farm = await prisma.farm.create({
        data: { name: farmName, user: { create: { name, email, passwordHash } } },
        select: { user: { select: accountSelect } },
      });
      const account = farm.user!;

      const token = await createSession(account.id);
      setSessionCookie(reply, token, config.cookieSecure);
      return reply.status(201).send(toResponse(account));
    },
  );

  // POST /auth/login — entra
  r.post(
    "/auth/login",
    {
      config: authRateLimit,
      schema: {
        tags: ["Conta"],
        summary: "Entra na conta",
        body: loginSchema,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({
        where: { email },
        select: { ...accountSelect, passwordHash: true },
      });

      // Sem conta, confere contra um hash "de mentira": o tempo de resposta é o
      // mesmo e a mensagem também — não revela se o e-mail existe.
      const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
      if (!user || !valid) {
        throw unauthorized(ErrorCode.INVALID_CREDENTIALS, "E-mail ou senha incorretos.");
      }

      const { passwordHash: _hash, ...account } = user;
      const token = await createSession(account.id);
      setSessionCookie(reply, token, config.cookieSecure);
      return toResponse(account);
    },
  );

  // POST /auth/logout — sai (apaga a sessão no banco e o cookie)
  r.post(
    "/auth/logout",
    { schema: { tags: ["Conta"], summary: "Sai da conta" } },
    async (request, reply) => {
      await deleteSession(request.cookies[SESSION_COOKIE]);
      clearSessionCookie(reply, config.cookieSecure);
      return reply.status(204).send();
    },
  );

  // GET /auth/me — quem está logado (o frontend chama ao abrir)
  r.get(
    "/auth/me",
    {
      onRequest: authenticate(config.cookieSecure),
      schema: { tags: ["Conta"], summary: "Usuário e fazenda da sessão atual" },
    },
    async (request) => request.auth,
  );
}
