import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Populando o banco...");

  // limpa os dados antigos (primeiro as pesagens, depois os animais,
  // por causa da relação entre eles)
  await prisma.weighing.deleteMany();
  await prisma.animal.deleteMany();

  // Animal 1 — um novilho com histórico de pesagens (pra ter GMD)
  const boi = await prisma.animal.create({
    data: {
      tag: "BR-001",
      sex: "MALE",
      category: "YEARLING",
      breed: "Nelore",
      birthDate: new Date("2023-03-15"),
      birthPrecision: "DAY_MONTH_YEAR",
      notes: "Animal de exemplo com histórico de pesagens.",
      weighings: {
        create: [
          { date: new Date("2024-06-01"), weightKg: 180.5 },
          { date: new Date("2024-09-01"), weightKg: 240 },
          { date: new Date("2024-12-01"), weightKg: 300 },
        ],
      },
    },
  });

  // Animal 2 — uma vaca, sem pesagens ainda
  const vaca = await prisma.animal.create({
    data: {
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
      tag: "BR-003",
      sex: "MALE",
      category: "CALF",
      breed: "Nelore",
      birthDate: new Date("2024-11-01"),
      birthPrecision: "MONTH_YEAR",
    },
  });

  console.log("✅ Banco populado:");
  console.log(`   - ${boi.tag} (com 3 pesagens)`);
  console.log(`   - ${vaca.tag}`);
  console.log(`   - ${bezerro.tag}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro ao popular o banco:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });