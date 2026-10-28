import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

// Cria um usuário para a "Fazenda inicial (dados do protótipo)".
//
// A migração da G1 colocou os dados antigos de teste nessa fazenda, que ainda
// não tem dono. Este comando cria o login dela, para você ver os dados antigos.
// Só para DESENVOLVIMENTO; não roda em produção. Pergunta nome, e-mail e senha
// no terminal (a senha não aparece enquanto você digita).
//
// Uso:  npm run dev:claim-initial-farm

const INITIAL_FARM_ID = "00000000-0000-4000-8000-000000000001";

// Saída que pode ser "silenciada" enquanto a senha é digitada
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Este comando é só para desenvolvimento.");
  }

  const prisma = new PrismaClient();
  try {
    const farm = await prisma.farm.findUnique({
      where: { id: INITIAL_FARM_ID },
      include: { user: { select: { email: true } } },
    });
    if (!farm) {
      console.log("Não existe fazenda inicial neste banco (não havia dados do protótipo).");
      return;
    }
    if (farm.user) {
      console.log(`A fazenda inicial já tem login: ${farm.user.email}`);
      return;
    }

    const rl = createInterface({ input: process.stdin, output, terminal: true });
    const name = (await rl.question("Seu nome: ")).trim();
    const email = (await rl.question("E-mail: ")).trim().toLowerCase();
    process.stdout.write("Senha (mínimo 8 caracteres): ");
    muted = true;
    const password = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    rl.close();

    if (!name || !email.includes("@") || password.length < 8) {
      throw new Error("Nome, e-mail válido e senha com 8+ caracteres são obrigatórios.");
    }

    await prisma.user.create({
      data: { farmId: farm.id, name, email, passwordHash: await hashPassword(password) },
    });
    console.log(`✅ Pronto! Entre no sistema com ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
