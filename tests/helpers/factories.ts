import type { App } from "../../src/app.js";
import { addDays, todayInTimeZone } from "../../src/lib/dates.js";

// Atalhos para montar cenários de teste PELA API (o mesmo caminho do usuário).

export const today = () => todayInTimeZone();
export const daysFromToday = (days: number) => addDays(today(), days);

let tagCounter = 0;
export const uniqueTag = () => `T-${Date.now()}-${++tagCounter}`;

export async function createAnimal(app: App, body: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/animals",
    payload: { tag: uniqueTag(), sex: "MALE", category: "CALF", ...body },
  });
  if (response.statusCode !== 201) {
    throw new Error(`createAnimal falhou: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { id: string; tag: string; status: string };
}

export async function createProduct(app: App, body: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/products",
    payload: { name: "Vacina Aftosa", type: "VACCINE", ...body },
  });
  if (response.statusCode !== 201) {
    throw new Error(`createProduct falhou: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { id: string; name: string };
}

export async function addWeighing(app: App, animalId: string, date: string, weightKg: number) {
  const response = await app.inject({
    method: "POST",
    url: `/animals/${animalId}/weighings`,
    payload: { date, weightKg },
  });
  if (response.statusCode !== 201) {
    throw new Error(`addWeighing falhou: ${response.statusCode} ${response.body}`);
  }
  return response.json() as { id: string };
}

export const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";
