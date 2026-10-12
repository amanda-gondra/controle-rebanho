import { prisma } from "../../src/lib/prisma.js";

// Tabelas de dados, das "filhas" para as "mães". A lista é fixa no código
// (nunca vem de fora), então pode ir direto no SQL.
const TABLES = [
  "ApplicationAnimal",
  "Application",
  "Product",
  "Weighing",
  "AnimalPurchase",
  "AnimalSale",
  "Animal",
];

// Esvazia o banco de TESTE entre os testes. Confere de novo, no próprio
// banco, que o nome termina em "_test" antes de apagar qualquer coisa.
export async function resetDatabase() {
  const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`
    SELECT current_database()::text AS name
  `;
  if (!name.endsWith("_test")) {
    throw new Error(`Recusado: "${name}" não é um banco de teste.`);
  }

  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
