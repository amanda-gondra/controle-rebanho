import { afterAll, beforeAll, beforeEach } from "vitest";
import type { App } from "../../src/app.js";
import { createTestApp } from "./app.js";
import { disconnectDatabase, resetDatabase } from "./database.js";

// Prepara um arquivo de teste de integração: uma API por arquivo e
// banco de teste vazio antes de CADA teste (um teste não afeta o outro).
export function useTestApp(): { readonly app: App } {
  const holder = {} as { app: App };

  beforeAll(async () => {
    holder.app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await holder.app?.close();
    await disconnectDatabase();
  });

  return holder;
}
