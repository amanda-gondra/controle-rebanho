import { spawnSync } from "node:child_process";
import {
  loadDotEnvIfPresent,
  readTestDatabaseUrl,
} from "../tests/helpers/test-database-url.js";

// Aplica as migrations no banco de TESTE (TEST_DATABASE_URL).
// Usa "migrate deploy": só aplica as migrations que existem, não cria nem
// apaga nada fora delas — o mesmo comando que roda em produção.
loadDotEnvIfPresent();
const testDatabaseUrl = readTestDatabaseUrl();

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});

process.exit(result.status ?? 1);
