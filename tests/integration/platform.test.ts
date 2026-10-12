import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { createTestApp } from "../helpers/app.js";
import { InvalidConfigError, loadConfig } from "../../src/config/env.js";
import { readTestDatabaseUrl } from "../helpers/test-database-url.js";

const t = useTestApp();
const SECRET_LOOKING_URL = "postgresql://user:SuperSecret123@db:5432/x";

describe("configuração (variáveis de ambiente)", () => {
  it("sem DATABASE_URL o servidor não sobe e diz qual variável falta", () => {
    expect(() => loadConfig({})).toThrow(InvalidConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("a mensagem de erro nunca mostra o VALOR das variáveis", () => {
    try {
      loadConfig({ DATABASE_URL: SECRET_LOOKING_URL, PORT: "abc", CORS_ORIGINS: "não-é-url" });
      throw new Error("deveria ter falhado");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      const message = (error as Error).message;
      expect(message).toMatch(/PORT/);
      expect(message).toMatch(/CORS_ORIGINS/);
      expect(message).not.toContain("SuperSecret123");
    }
  });

  it("documentação da API desligada em produção por padrão", () => {
    const config = loadConfig({ DATABASE_URL: SECRET_LOOKING_URL, NODE_ENV: "production" });
    expect(config.apiDocsEnabled).toBe(false);
    expect(loadConfig({ DATABASE_URL: SECRET_LOOKING_URL }).apiDocsEnabled).toBe(true);
  });

  it("aceita várias origens de CORS separadas por vírgula", () => {
    const config = loadConfig({
      DATABASE_URL: SECRET_LOOKING_URL,
      CORS_ORIGINS: "https://app.exemplo.com, http://localhost:5173",
    });
    expect(config.corsOrigins).toEqual(["https://app.exemplo.com", "http://localhost:5173"]);
  });
});

describe("proteção do banco de teste", () => {
  it("recusa banco cujo nome não termina em _test", () => {
    expect(() =>
      readTestDatabaseUrl({ TEST_DATABASE_URL: "postgresql://u:p@localhost:5433/rebanho" }),
    ).toThrow(/_test/);
  });

  it("recusa TEST_DATABASE_URL igual à DATABASE_URL", () => {
    const url = "postgresql://u:p@localhost:5433/rebanho_test";
    expect(() => readTestDatabaseUrl({ TEST_DATABASE_URL: url, DATABASE_URL: url })).toThrow();
  });

  it("recusa quando a variável não existe", () => {
    expect(() => readTestDatabaseUrl({})).toThrow(/TEST_DATABASE_URL/);
  });
});

describe("respostas de erro HTTP (nunca 500 para erro do cliente)", () => {
  it("rota inexistente → 404 ROUTE_NOT_FOUND", async () => {
    const response = await t.app.inject({ url: "/nao-existe" });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("ROUTE_NOT_FOUND");
  });

  it("rotas antigas em português não existem mais", async () => {
    const response = await t.client.inject({
      url: "/animals/00000000-0000-4000-8000-000000000000/pesagens",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("ROUTE_NOT_FOUND");
  });

  it("JSON malformado → 400 BAD_REQUEST (antes virava 500)", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      headers: { "content-type": "application/json" },
      payload: "{tag:",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("BAD_REQUEST");
  });

  it("tipo de conteúdo não suportado → 415", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      headers: { "content-type": "text/xml" },
      payload: "<animal/>",
    });
    expect(response.statusCode).toBe(415);
    expect(response.json().code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("corpo grande demais → 413", async () => {
    const response = await t.client.inject({
      method: "POST",
      url: "/animals",
      payload: { tag: "x", sex: "MALE", category: "CALF", notes: "x".repeat(1_100_000) },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("cabeçalhos de segurança presentes (helmet)", async () => {
    const response = await t.app.inject({ url: "/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("limite de requisições e CORS", () => {
  it("passou do limite → 429 RATE_LIMITED (antes virava 500)", async () => {
    const app = await createTestApp({ RATE_LIMIT_MAX: "2" });
    try {
      await app.inject({ url: "/health" });
      await app.inject({ url: "/health" });
      const response = await app.inject({ url: "/health" });
      expect(response.statusCode).toBe(429);
      expect(response.json().code).toBe("RATE_LIMITED");
    } finally {
      await app.close();
    }
  });

  it("CORS libera só as origens configuradas", async () => {
    const app = await createTestApp({ CORS_ORIGINS: "https://app.exemplo.com" });
    try {
      const allowed = await app.inject({
        url: "/health",
        headers: { origin: "https://app.exemplo.com" },
      });
      expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.exemplo.com");

      const blocked = await app.inject({
        url: "/health",
        headers: { origin: "https://site-malicioso.com" },
      });
      expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("documentação desligada não expõe /docs", async () => {
    const response = await t.app.inject({ url: "/docs" });
    expect(response.statusCode).toBe(404);
  });
});
