import { loadDotEnvIfPresent, readTestDatabaseUrl } from "../helpers/test-database-url.js";

// Roda ANTES de cada arquivo de teste de integração (antes dos imports dele).
// Aponta o Prisma para o banco de teste — nunca para o de desenvolvimento.
loadDotEnvIfPresent();
const testDatabaseUrl = readTestDatabaseUrl();

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = "test";
