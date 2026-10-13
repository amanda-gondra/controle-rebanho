import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

// Dados de exemplo para DESENVOLVIMENTO: uma fazenda, um usuário e 3 animais.
//
// Segurança:
// - NUNCA apaga nada; recusa rodar em produção e em banco que já tenha dados (F-02);
// - a senha do usuário de exemplo vem de variável de ambiente (nunca fica no código).
//
// Uso:  SEED_USER_EMAIL=voce@exemplo.com SEED_USER_PASSWORD=... npx prisma db seed
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("O seed de exemplo não roda em produção.");
  }

  const email = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_USER_PASSWORD;
  if (!email || !password || password.length < 8) {
    throw new Error(
      "Defina SEED_USER_EMAIL e SEED_USER_PASSWORD (mínimo 8 caracteres) para criar o usuário de exemplo.",
    );
  }

  const [farms, animals, products] = await Promise.all([
    prisma.farm.count(),
    prisma.animal.count(),
    prisma.product.count(),
  ]);
  if (farms + animals + products > 0) {
    console.log("⚠️  O banco já tem dados. O seed só roda em banco vazio e não apagou nada.");
    return;
  }

  console.log("🌱 Populando o banco...");

  const farm = await prisma.farm.create({
    data: {
      name: "Fazenda Exemplo",
      user: {
        create: { name: "Usuário de exemplo", email, passwordHash: await hashPassword(password) },
      },
    },
  });
  const farmId = farm.id;

  // Animal 1 — um garrote com histórico de pesagens (pra ter GMD)
  const boi = await prisma.animal.create({
    data: {
      farmId,
      tag: "BR-001",
      sex: "MALE",
      category: "YEARLING",
      castrated: false,
      breed: "Nelore",
      birthDate: new Date("2023-03-15"),
      birthPrecision: "DAY_MONTH_YEAR",
      notes: "Animal de exemplo com histórico de pesagens.",
      weighings: {
        create: [
          { farmId, date: new Date("2024-06-01"), weightKg: 180.5 },
          { farmId, date: new Date("2024-09-01"), weightKg: 240 },
          { farmId, date: new Date("2024-12-01"), weightKg: 300 },
        ],
      },
    },
  });

  // Animal 2 — uma vaca, sem pesagens ainda
  const vaca = await prisma.animal.create({
    data: {
      farmId,
      tag: "BR-002",
      sex: "FEMALE",
      category: "COW",
      breed: "Gir",
      birthPrecision: "UNKNOWN",
      notes: "Idade estimada no olhômetro.",
    },
  });

  // Animal 3 — um bezerro recém-nascido
  const bezerro = await prisma.animal.create({
    data: {
      farmId,
      tag: "BR-003",
      sex: "MALE",
      category: "CALF",
      castrated: false,
      breed: "Nelore",
      birthDate: new Date("2024-11-01"),
      birthPrecision: "MONTH_YEAR",
    },
  });

  console.log(`✅ Banco populado: fazenda "${farm.name}", usuário ${email}`);
  console.log(`   - ${boi.tag} (com 3 pesagens)`);
  console.log(`   - ${vaca.tag}`);
  console.log(`   - ${bezerro.tag}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao popular o banco:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
