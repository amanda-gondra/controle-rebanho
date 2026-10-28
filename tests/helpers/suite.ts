import { afterAll, beforeAll, beforeEach } from "vitest";
import type { App } from "../../src/app.js";
import { createTestApp } from "./app.js";
import { type Client, createLoggedClient } from "./client.js";
import { disconnectDatabase, resetDatabase } from "./database.js";

// Prepara um arquivo de teste de integração: uma API por arquivo, banco de
// teste vazio antes de CADA teste e um usuário já logado (`client`) numa
// fazenda nova — um teste não afeta o outro.
export function useTestApp(): { readonly app: App; readonly client: Client } {
  const holder = {} as { app: App; client: Client };

  beforeAll(async () => {
    holder.app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    holder.client = await createLoggedClient(holder.app);
  });

  afterAll(async () => {
    await holder.app?.close();
    await disconnectDatabase();
  });

  return holder;
}
