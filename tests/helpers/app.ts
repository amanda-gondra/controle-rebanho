import { buildApp, type App } from "../../src/app.js";
import { loadConfig } from "../../src/config/env.js";

// Cria a API para teste: sem log, sem documentação e com limite de
// requisições alto (os testes fazem muitas chamadas seguidas do mesmo "IP").
export async function createTestApp(overrides: Record<string, string> = {}): Promise<App> {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    API_DOCS_ENABLED: "false",
    RATE_LIMIT_MAX: "100000",
    ...overrides,
  });
  const app = await buildApp(config);
  await app.ready();
  return app;
}
