import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { createTestApp } from "../helpers/app.js";
import { TEST_PASSWORD, sessionCookieFrom } from "../helpers/client.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  SESSION_COOKIE,
  hashToken,
} from "../../src/lib/session.js";

const t = useTestApp();

const newAccount = {
  farmName: "Fazenda Boa Vista",
  name: "Maria",
  email: "Maria@Exemplo.com ",
  password: "senha-forte-123",
};

const register = (payload: Record<string, unknown> = newAccount) =>
  t.app.inject({ method: "POST", url: "/auth/register", payload });

const login = (email: string, password: string) =>
  t.app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });

describe("criar conta", () => {
  it("cria fazenda e usuário juntos, entra na hora e não devolve a senha", async () => {
    const response = await register();
    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.user).toMatchObject({ name: "Maria", email: "maria@exemplo.com" });
    expect(body.farm).toMatchObject({ name: "Fazenda Boa Vista", timezone: "America/Sao_Paulo" });
    expect(JSON.stringify(body)).not.toMatch(/password|senha-forte/i);

    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(cookie.path).toBe("/");

    const me = await t.app.inject({ url: "/auth/me", headers: { cookie: sessionCookieFrom(response)! } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("maria@exemplo.com");
  });

  it("guarda só o hash da senha e só o hash do token da sessão", async () => {
    const response = await register();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "maria@exemplo.com" } });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain(newAccount.password);

    const token = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
    expect(await prisma.session.count({ where: { tokenHash: hashToken(token) } })).toBe(1);
  });

  it("e-mail já cadastrado (sem diferenciar maiúsculas) → 409 e nada é criado", async () => {
    await register();
    const farmsBefore = await prisma.farm.count();
    const response = await register({ ...newAccount, email: "MARIA@exemplo.com" });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(await prisma.farm.count()).toBe(farmsBefore);
  });

  it("dois cadastros simultâneos com o mesmo e-mail: só um é criado", async () => {
    const [a, b] = await Promise.all([register(), register()]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    expect(await prisma.user.count({ where: { email: "maria@exemplo.com" } })).toBe(1);
    // a fazenda do cadastro que falhou não fica órfã
    expect(await prisma.farm.count({ where: { name: "Fazenda Boa Vista" } })).toBe(1);
  });

  it.each([
    ["senha curta", { password: "1234567" }],
    ["senha longa demais", { password: "x".repeat(129) }],
    ["e-mail inválido", { email: "maria" }],
    ["sem nome da fazenda", { farmName: "  " }],
    ["campo extra (ex.: farmId)", { farmId: "00000000-0000-4000-8000-000000000001" }],
  ])("recusa %s com 400", async (_label, override) => {
    const response = await register({ ...newAccount, ...override });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("VALIDATION_ERROR");
  });
});

describe("entrar e sair", () => {
  it("entra com e-mail e senha certos (e-mail sem diferenciar maiúsculas)", async () => {
    const response = await login(` ${t.client.user.email.toUpperCase()} `, TEST_PASSWORD);
    expect(response.statusCode).toBe(200);
    expect(sessionCookieFrom(response)).toBeDefined();
  });

  it("senha errada e e-mail inexistente dão a MESMA resposta (não revela quem tem conta)", async () => {
    const wrongPassword = await login(t.client.user.email, "senha-errada-999");
    const unknownEmail = await login("ninguem@teste.local", "senha-errada-999");

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        code: "INVALID_CREDENTIALS",
        message: "E-mail ou senha incorretos.",
      });
      expect(sessionCookieFrom(response)).toBeUndefined();
    }
  });

  it("sair apaga a sessão no banco: o mesmo cookie deixa de funcionar", async () => {
    const before = await t.client.inject({ url: "/animals" });
    expect(before.statusCode).toBe(200);

    const logout = await t.client.inject({ method: "POST", url: "/auth/logout" });
    expect(logout.statusCode).toBe(204);

    const after = await t.client.inject({ url: "/animals" });
    expect(after.statusCode).toBe(401);
    expect(after.json().code).toBe("UNAUTHENTICATED");
  });

  it("muitas tentativas de login → 429 (força bruta)", async () => {
    const app = await createTestApp({ AUTH_RATE_LIMIT_MAX: "3" });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { email: "x@teste.local", password: "qualquer-coisa" },
        });
        codes.push(response.statusCode);
      }
      expect(codes).toEqual([401, 401, 401, 429]);
    } finally {
      await app.close();
    }
  });
});

describe("sessão", () => {
  it.each([
    ["sem cookie", undefined],
    ["cookie inventado", `${SESSION_COOKIE}=token-que-nao-existe`],
    ["cookie vazio", `${SESSION_COOKIE}=`],
  ])("rota privada %s → 401 UNAUTHENTICATED", async (_label, cookie) => {
    const response = await t.app.inject({
      url: "/animals",
      headers: cookie ? { cookie } : {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("UNAUTHENTICATED");
  });

  it("todas as rotas de dados exigem login", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const routes: [string, string][] = [
      ["GET", "/animals"],
      ["POST", "/animals"],
      ["GET", `/animals/${id}`],
      ["PUT", `/animals/${id}`],
      ["DELETE", `/animals/${id}`],
      ["PATCH", `/animals/${id}/status`],
      ["GET", `/animals/${id}/weighings`],
      ["POST", `/animals/${id}/weighings`],
      ["PUT", `/animals/${id}/weighings/${id}`],
      ["DELETE", `/animals/${id}/weighings/${id}`],
      ["GET", `/animals/${id}/weight-gain`],
      ["GET", "/products"],
      ["POST", "/products"],
      ["GET", "/applications"],
      ["POST", "/applications"],
      ["GET", `/applications/${id}`],
      ["PUT", `/applications/${id}`],
      ["DELETE", `/applications/${id}`],
      ["GET", "/alerts"],
      ["GET", `/animals/${id}/applications`],
      ["POST", `/animals/${id}/purchase`],
      ["GET", `/animals/${id}/purchase`],
      ["PUT", `/animals/${id}/purchase`],
      ["DELETE", `/animals/${id}/purchase`],
      ["POST", `/animals/${id}/sale`],
      ["GET", `/animals/${id}/sale`],
      ["PUT", `/animals/${id}/sale`],
      ["DELETE", `/animals/${id}/sale`],
      ["PATCH", `/animals/${id}/estimated-price`],
      ["GET", `/animals/${id}/result`],
      ["GET", "/auth/me"],
    ];
    for (const [method, url] of routes) {
      const response = await t.app.inject({ method: method as "GET", url, payload: method === "GET" || method === "DELETE" ? undefined : {} });
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("sessão parada há mais de 7 dias → 401 SESSION_EXPIRED e é apagada", async () => {
    await prisma.session.updateMany({
      where: { userId: t.client.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const response = await t.client.inject({ url: "/animals" });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("SESSION_EXPIRED");
    expect(await prisma.session.count({ where: { userId: t.client.user.id } })).toBe(0);
  });

  it("sessão com mais de 30 dias vence mesmo em uso", async () => {
    await prisma.session.updateMany({
      where: { userId: t.client.user.id },
      data: { createdAt: new Date(Date.now() - ABSOLUTE_TIMEOUT_MS - 1000) },
    });
    const response = await t.client.inject({ url: "/animals" });
    expect(response.json().code).toBe("SESSION_EXPIRED");
  });

  it("usar o sistema renova a validade por inatividade", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.session.updateMany({
      where: { userId: t.client.user.id },
      data: { lastUsedAt: twoHoursAgo, expiresAt: new Date(Date.now() + 60_000) },
    });
    await t.client.inject({ url: "/animals" });
    const session = await prisma.session.findFirstOrThrow({ where: { userId: t.client.user.id } });
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + IDLE_TIMEOUT_MS - 60_000);
  });
});
