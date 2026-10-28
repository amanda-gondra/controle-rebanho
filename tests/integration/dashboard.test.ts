import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { addWeighing, createAnimal, createProduct, sellAnimal, today } from "../helpers/factories.js";

// PAINEL MÍNIMO (D-50), 2026-10-21: cada número confere com a regra escrita.

const t = useTestApp();
const dashboard = async (query = "") => {
  const response = await t.client.inject({ url: `/dashboard${query}` });
  expect(response.statusCode).toBe(200);
  return response.json();
};

describe("GET /dashboard", () => {
  it("fazenda vazia: tudo zero, sem GMD médio (nunca zero inventado)", async () => {
    const data = await dashboard();
    expect(data.period).toEqual({ from: `${today().slice(0, 7)}-01`, to: today() });
    expect(data.herd).toEqual({ active: 0, byCategory: [], byLot: [], withoutLot: 0 });
    expect(data.movements).toEqual({ entries: {}, entriesTotal: 0, sold: 0, died: 0 });
    expect(data.gain).toEqual({ averageDailyGainKg: null, animalsWithGain: 0, animalsWithoutGain: 0 });
    expect(data.weighings).toEqual({ inPeriod: 0, animalsWeighed: 0, recent: [] });
  });

  it("rebanho por categoria e por lote conta só animais ATIVOS", async () => {
    const [cow1, cow2, calf] = [
      await createAnimal(t.client, { sex: "FEMALE", category: "COW" }),
      await createAnimal(t.client, { sex: "FEMALE", category: "COW" }),
      await createAnimal(t.client, { sex: "MALE", category: "CALF" }),
    ];
    const dead = await createAnimal(t.client, { sex: "FEMALE", category: "COW" });
    await t.client.inject({ method: "PATCH", url: `/animals/${dead.id}/status`, payload: { status: "DEAD", exitDate: "2026-02-10" } });

    const lot = (await t.client.inject({ method: "POST", url: "/lots", payload: { name: "Maternidade" } })).json();
    await t.client.inject({ method: "POST", url: `/lots/${lot.id}/animals`, payload: { animalIds: [cow1.id, cow2.id], date: "2026-01-05" } });

    const data = await dashboard();
    expect(data.herd.active).toBe(3);
    expect(data.herd.byCategory).toEqual([
      { category: "COW", sex: "FEMALE", count: 2 },
      { category: "CALF", sex: "MALE", count: 1 },
    ]);
    expect(data.herd.byLot).toEqual([{ lotId: lot.id, name: "Maternidade", count: 2 }]);
    expect(data.herd.withoutLot).toBe(1);
    expect(calf.status).toBe("ACTIVE");
  });

  it("entradas pela data de entrada (por origem); vendas e mortes pela data de saída, só dentro do período", async () => {
    await createAnimal(t.client, { origin: "BORN_ON_FARM", entryDate: "2026-01-10" });
    await createAnimal(t.client, { origin: "RECEIVED", entryDate: "2026-01-20" });
    await createAnimal(t.client, { origin: "RECEIVED", entryDate: "2025-12-31" }); // fora
    const sold = await createAnimal(t.client);
    await sellAnimal(t.client, sold.id, "2026-01-15");
    const soldLater = await createAnimal(t.client);
    await sellAnimal(t.client, soldLater.id, "2026-02-01"); // fora
    const dead = await createAnimal(t.client);
    await t.client.inject({ method: "PATCH", url: `/animals/${dead.id}/status`, payload: { status: "DEAD", exitDate: "2026-01-31" } });

    const data = await dashboard("?from=2026-01-01&to=2026-01-31");
    expect(data.period).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(data.movements).toEqual({ entries: { BORN_ON_FARM: 1, RECEIVED: 1 }, entriesTotal: 2, sold: 1, died: 1 });
  });

  it("pesagens do período, últimas pesagens e GMD médio dos ativos (regra da ficha)", async () => {
    const a = await createAnimal(t.client, { tag: "P-1" });
    const b = await createAnimal(t.client, { tag: "P-2" });
    await createAnimal(t.client, { tag: "P-3" }); // sem pesagem: sem GMD
    await addWeighing(t.client, a.id, "2026-01-01", 200);
    await addWeighing(t.client, a.id, "2026-01-11", 210); // 1,000 kg/dia
    await addWeighing(t.client, b.id, "2026-01-01", 300);
    await addWeighing(t.client, b.id, "2026-01-21", 310); // 0,500 kg/dia
    await addWeighing(t.client, b.id, "2025-12-01", 300); // fora do período; muda o GMD de B (primeira pesagem)

    const data = await dashboard("?from=2026-01-01&to=2026-01-31");
    expect(data.weighings.inPeriod).toBe(4);
    expect(data.weighings.animalsWeighed).toBe(2);
    expect(data.weighings.recent[0]).toMatchObject({ date: "2026-01-21", weightKg: "310", animal: { id: b.id, tag: "P-2" } });
    // B: 300 (01/12) → 310 (21/01) = 10 kg em 51 dias = 0,196
    expect(data.gain).toEqual({ averageDailyGainKg: Number(((1 + 0.196) / 2).toFixed(3)), animalsWithGain: 2, animalsWithoutGain: 1 });
  });

  it("lembretes: os mesmos de /alerts (vencidos e chegando)", async () => {
    const animal = await createAnimal(t.client);
    const product = await createProduct(t.client);
    await t.client.inject({
      method: "POST",
      url: "/applications",
      payload: { productId: product.id, date: "2026-01-01", reapplyDate: "2026-02-01", animalIds: [animal.id] },
    });
    const data = await dashboard();
    const alerts = (await t.client.inject({ url: "/alerts" })).json();
    expect(data.reminders.overdue).toBe(alerts.filter((a: { overdue: boolean }) => a.overdue).length);
    expect(data.reminders.overdue).toBe(1);
    expect(data.reminders.upcoming).toBe(0);
  });

  it("período inválido é recusado", async () => {
    const backwards = await t.client.inject({ url: "/dashboard?from=2026-02-01&to=2026-01-01" });
    expect(backwards.statusCode).toBe(400);
    const tooLong = await t.client.inject({ url: "/dashboard?from=2020-01-01&to=2026-01-01" });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().errors[0].code).toBe("PERIOD_TOO_LONG");
    const extra = await t.client.inject({ url: "/dashboard?farmId=x" });
    expect(extra.statusCode).toBe(400);
  });
});
