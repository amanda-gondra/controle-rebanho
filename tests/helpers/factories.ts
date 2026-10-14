import type { Client } from "./client.js";
import { addDays, todayInTimeZone } from "../../src/lib/dates.js";

// Atalhos para montar cenários de teste PELA API (o mesmo caminho do usuário),
// sempre como um usuário logado (`Client`).

export const today = () => todayInTimeZone();
export const daysFromToday = (days: number) => addDays(today(), days);

let tagCounter = 0;
export const uniqueTag = () => `T-${Date.now()}-${++tagCounter}`;

export async function createAnimal(app: Client, body: Record<string, unknown> = {}) {
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

export async function createProduct(app: Client, body: Record<string, unknown> = {}) {
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

export async function addWeighing(app: Client, animalId: string, date: string, weightKg: number) {
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

// Negociação (G5). Atalhos: um animal por kg — o caso mais comum dos testes.
export async function createTrade(app: Client, body: Record<string, unknown>) {
  const response = await app.inject({ method: "POST", url: "/trades", payload: body });
  if (response.statusCode !== 201) {
    throw new Error(`createTrade falhou: ${response.statusCode} ${response.body}`);
  }
  return response.json() as {
    id: string;
    total: string | null;
    items: { id: string; value: string | null; animal: { id: string; tag: string } }[];
  };
}

export const sellAnimal = (app: Client, animalId: string, date: string, liveWeightKg = 420, unitPrice = 11) =>
  createTrade(app, { type: "SALE", date, priceUnit: "PER_KG", items: [{ animalId, liveWeightKg, unitPrice }] });

export const buyAnimal = (app: Client, animalId: string, date: string, liveWeightKg = 200, unitPrice = 12.5) =>
  createTrade(app, { type: "PURCHASE", date, priceUnit: "PER_KG", items: [{ animalId, liveWeightKg, unitPrice }] });

export const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";
