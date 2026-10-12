import type { InjectOptions, LightMyRequestResponse } from "fastify";
import type { App } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/lib/password.js";
import { SESSION_COOKIE, createSession } from "../../src/lib/session.js";

// Um "navegador" de teste: faz requisições já logado numa fazenda.
export type Client = {
  inject: (options: InjectOptions) => Promise<LightMyRequestResponse>;
  farm: { id: string; name: string };
  user: { id: string; email: string };
  cookie: string;
};

export const TEST_PASSWORD = "senha-de-teste-123";

// O hash é calculado uma vez só por arquivo (scrypt é lento de propósito)
let passwordHash: Promise<string> | null = null;
const getPasswordHash = () => (passwordHash ??= hashPassword(TEST_PASSWORD));

let counter = 0;

// Cria uma fazenda com usuário direto no banco e abre uma sessão para ela.
export async function createLoggedClient(app: App, farmName = "Fazenda Teste"): Promise<Client> {
  counter += 1;
  const email = `usuario${counter}-${Date.now()}@teste.local`;
  const farm = await prisma.farm.create({
    data: {
      name: farmName,
      user: { create: { name: `Usuário ${counter}`, email, passwordHash: await getPasswordHash() } },
    },
    include: { user: true },
  });
  const token = await createSession(farm.user!.id);
  const cookie = `${SESSION_COOKIE}=${token}`;

  return {
    farm: { id: farm.id, name: farm.name },
    user: { id: farm.user!.id, email },
    cookie,
    inject: (options) =>
      app.inject({ ...options, headers: { ...options.headers, cookie } }),
  };
}

// Lê o token do cabeçalho Set-Cookie de uma resposta de login/cadastro
export function sessionCookieFrom(response: LightMyRequestResponse): string | undefined {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE);
  return cookie && cookie.value ? `${SESSION_COOKIE}=${cookie.value}` : undefined;
}
