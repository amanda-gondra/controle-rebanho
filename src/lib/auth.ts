import type { FastifyReply, FastifyRequest } from "fastify";
import { ErrorCode, unauthorized } from "./errors.js";
import { SESSION_COOKIE, clearSessionCookie, findSession } from "./session.js";
import { forFarm, type FarmDb } from "./tenant.js";

// Quem está logado e de qual fazenda.
export type AuthContext = {
  user: { id: string; name: string; email: string };
  farm: { id: string; name: string; country: string; timezone: string };
};

// Toda rota PROTEGIDA recebe em `request`:
// - `auth`: usuário e fazenda da sessão;
// - `db`: acesso ao banco já filtrado pela fazenda (src/lib/tenant.ts).
// Em rotas públicas esses campos ficam nulos — por isso só use dentro do
// grupo protegido (app.ts), onde o gancho `authenticate` garante os dois.
declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
    db: FarmDb;
  }
}

// Gancho que roda antes de toda rota protegida.
export function authenticate(cookieSecure: boolean) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    const session = await findSession(token);

    if (session.status === "expired") {
      clearSessionCookie(reply, cookieSecure);
      throw unauthorized(
        ErrorCode.SESSION_EXPIRED,
        "Sua sessão expirou. Entre de novo para continuar.",
      );
    }
    if (session.status === "missing") {
      throw unauthorized(ErrorCode.UNAUTHENTICATED, "Entre na sua conta para continuar.");
    }

    request.auth = { user: session.user, farm: session.farm };
    // O farmId vem SÓ da sessão — nunca do corpo, da URL ou da query.
    request.db = forFarm(session.farm.id);
  };
}
