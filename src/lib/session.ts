import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply } from "fastify";
import { prisma } from "./prisma.js";

// Sessão de login (D-23).
//
// - O navegador recebe um token aleatório (256 bits) num cookie HttpOnly
//   (o JavaScript da página não consegue ler → protege contra roubo por XSS).
// - O banco guarda só o HASH do token: quem ler o banco não consegue se
//   passar pelo usuário.
// - Sair = apagar a sessão no banco (revogação imediata).
//
// Validade:
// - 7 dias sem uso → vence (renovada a cada uso, no máximo 1 escrita por hora);
// - 30 dias desde o login → vence de qualquer jeito (precisa entrar de novo).

export const SESSION_COOKIE = "rebanho_session";

const DAY_MS = 24 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 7 * DAY_MS;
export const ABSOLUTE_TIMEOUT_MS = 30 * DAY_MS;
const RENEW_AFTER_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");

  // Aproveita o login para limpar sessões vencidas deste usuário
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: now } } });

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
      lastUsedAt: now,
      createdAt: now,
    },
  });

  return token;
}

export type SessionLookup =
  | { status: "missing" }
  | { status: "expired" }
  | {
      status: "valid";
      user: { id: string; name: string; email: string };
      farm: { id: string; name: string; country: string; timezone: string };
    };

// Confere o token do cookie. Sessão vencida é apagada na hora.
export async function findSession(
  token: string | undefined,
  now: Date = new Date(),
): Promise<SessionLookup> {
  if (!token) return { status: "missing" };

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          farm: { select: { id: true, name: true, country: true, timezone: true } },
        },
      },
    },
  });
  if (!session) return { status: "missing" };

  const idleExpired = session.expiresAt.getTime() <= now.getTime();
  const absoluteExpired =
    session.createdAt.getTime() + ABSOLUTE_TIMEOUT_MS <= now.getTime();

  if (idleExpired || absoluteExpired) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return { status: "expired" };
  }

  // Renova a validade por inatividade (no máximo uma escrita por hora)
  if (now.getTime() - session.lastUsedAt.getTime() > RENEW_AFTER_MS) {
    await prisma.session.updateMany({
      where: { id: session.id },
      data: { lastUsedAt: now, expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS) },
    });
  }

  const { farm, ...user } = session.user;
  return { status: "valid", user, farm };
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, // o JavaScript da página não lê
    secure, // só HTTPS (em produção)
    sameSite: "lax", // não vai em requisições de outros sites (CSRF)
    path: "/",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean) {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: "lax", path: "/" });
}
