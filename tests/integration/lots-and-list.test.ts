import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { addWeighing, createAnimal, daysFromToday, sellAnimal, today } from "../helpers/factories.js";
import { prisma } from "../../src/lib/prisma.js";

// LOTES (D-49) e LISTA DO REBANHO NO SERVIDOR (F-15/F-16), 2026-10-18.

const t = useTestApp();

const createLot = async (name: string) => (await t.client.inject({ method: "POST", url: "/lots", payload: { name } })).json();
const move = (lotId: string, animalIds: string[], date: string) =>
  t.client.inject({ method: "POST", url: `/lots/${lotId}/animals`, payload: { animalIds, date } });
const list = async (query = "") => (await t.client.inject({ url: `/animals${query}` })).json();

describe("lotes (D-49)", () => {
  it("cria, nome único sem diferenciar maiúsculas, conta animais ativos", async () => {
    const lot = await createLot("Recria 1");
    const dup = await t.client.inject({ method: "POST", url: "/lots", payload: { name: "recria 1" } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().code).toBe("DUPLICATE_LOT_NAME");

    const [a, b] = [await createAnimal(t.client), await createAnimal(t.client)];
    const moved = await move(lot.id, [a.id, b.id], "2026-03-01");
    expect(moved.json()).toEqual({ moved: 2, unchanged: 0 });
    const lots = (await t.client.inject({ url: "/lots" })).json();
    expect(lots[0]).toMatchObject({ name: "Recria 1", activeCount: 2 });
  });

  it("trocar de lote fecha o período anterior na data e guarda o histórico", async () => {
    const [lotA, lotB] = [await createLot("A"), await createLot("B")];
    const animal = await createAnimal(t.client);
    await move(lotA.id, [animal.id], "2026-03-01");
    await move(lotB.id, [animal.id], "2026-04-01");
    // mover de novo para o mesmo lote não duplica
    expect((await move(lotB.id, [animal.id], "2026-04-05")).json()).toEqual({ moved: 0, unchanged: 1 });

    const periods = await prisma.lotMembership.findMany({ where: { animalId: animal.id }, orderBy: { startDate: "asc" } });
    expect(periods.map((p) => [p.lotId, p.startDate.toISOString().slice(0, 10), p.endDate?.toISOString().slice(0, 10) ?? null])).toEqual([
      [lotA.id, "2026-03-01", "2026-04-01"],
      [lotB.id, "2026-04-01", null],
    ]);
    const detail = (await t.client.inject({ url: `/animals/${animal.id}` })).json();
    expect(detail.lot).toEqual({ id: lotB.id, name: "B", since: "2026-04-01" });
    const history = (await t.client.inject({ url: `/animals/${animal.id}/history` })).json();
    expect(history.items.map((e: { type: string; toValue: string }) => [e.type, JSON.parse(e.toValue).name])).toEqual([
      ["LOT_CHANGED", "B"],
      ["LOT_CHANGED", "A"],
    ]);
    const lotDetail = (await t.client.inject({ url: `/lots/${lotA.id}` })).json();
    expect(lotDetail).toMatchObject({ activeCount: 0, animals: [] });
    expect(lotDetail.history).toHaveLength(1);
  });

  it("troca com data antes da entrada no lote atual é recusada, com o brinco", async () => {
    const [lotA, lotB] = [await createLot("A"), await createLot("B")];
    const animal = await createAnimal(t.client, { tag: "L-9" });
    await move(lotA.id, [animal.id], "2026-03-10");
    const response = await move(lotB.id, [animal.id], "2026-03-01");
    expect(response.statusCode).toBe(422);
    expect(response.json().errors[0]).toMatchObject({ code: "LOT_DATE_BEFORE_CURRENT", params: { tag: "L-9", date: "2026-03-10" } });
  });

  it("vendido não muda de lote; a venda fecha o período e desfazer reabre", async () => {
    const lot = await createLot("Engorda");
    const animal = await createAnimal(t.client);
    await move(lot.id, [animal.id], "2026-03-01");
    const sale = await sellAnimal(t.client, animal.id, "2026-05-10");
    let period = await prisma.lotMembership.findFirstOrThrow({ where: { animalId: animal.id } });
    expect(period.endDate?.toISOString().slice(0, 10)).toBe("2026-05-10");
    expect((await t.client.inject({ url: "/lots" })).json()[0].activeCount).toBe(0);

    const other = await createLot("Outro");
    const blocked = await move(other.id, [animal.id], "2026-06-01");
    expect(blocked.json().errors[0].code).toBe("ANIMAL_NOT_ACTIVE");

    await t.client.inject({ method: "DELETE", url: `/trades/${sale.id}` });
    period = await prisma.lotMembership.findFirstOrThrow({ where: { animalId: animal.id } });
    expect(period.endDate).toBeNull();
  });

  it("saída antes da entrada no lote é recusada (EXIT_DATE_CONFLICT LOT)", async () => {
    const lot = await createLot("A");
    const animal = await createAnimal(t.client);
    await move(lot.id, [animal.id], "2026-03-10");
    const response = await t.client.inject({
      method: "PATCH",
      url: `/animals/${animal.id}/status`,
      payload: { status: "DEAD", exitDate: "2026-03-01" },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().errors[0].params).toMatchObject({ kind: "LOT", date: "2026-03-10" });
  });

  it("tirar do lote; arquivar só vazio; excluir só lote que nunca teve animal", async () => {
    const lot = await createLot("Temporário");
    const animal = await createAnimal(t.client);
    await move(lot.id, [animal.id], "2026-03-01");
    expect((await t.client.inject({ method: "PATCH", url: `/lots/${lot.id}/archive` })).json().code).toBe("LOT_NOT_EMPTY");
    const removed = await t.client.inject({ method: "POST", url: `/lots/${lot.id}/remove`, payload: { animalIds: [animal.id], date: "2026-03-05" } });
    expect(removed.json()).toEqual({ moved: 1, unchanged: 0 });
    expect((await t.client.inject({ method: "DELETE", url: `/lots/${lot.id}` })).json().code).toBe("LOT_IN_USE");
    expect((await t.client.inject({ method: "PATCH", url: `/lots/${lot.id}/archive` })).statusCode).toBe(200);
    expect((await t.client.inject({ url: "/lots" })).json()).toHaveLength(0);
    expect((await move(lot.id, [animal.id], "2026-03-06")).json().code).toBe("LOT_ARCHIVED");

    const empty = await createLot("Nunca usado");
    expect((await t.client.inject({ method: "DELETE", url: `/lots/${empty.id}` })).statusCode).toBe(204);
  });

  it("data futura é recusada", async () => {
    const lot = await createLot("A");
    const animal = await createAnimal(t.client);
    expect((await move(lot.id, [animal.id], daysFromToday(2))).statusCode).toBe(400);
  });
});

describe("lista do rebanho no servidor (F-16)", () => {
  it("20 por página, total e contadores do rebanho inteiro (critério 10)", async () => {
    for (let i = 1; i <= 45; i += 1) await createAnimal(t.client, { tag: `BR-${String(i).padStart(2, "0")}` });
    const first = await list();
    expect(first).toMatchObject({ total: 45, page: 1, pageSize: 20, counts: { ALL: 45, ACTIVE: 45, SOLD: 0, DEAD: 0 } });
    expect(first.items).toHaveLength(20);
    const third = await list("?page=3");
    expect(third.items).toHaveLength(5);
    const search = await list("?q=br-1");
    expect(search.items.map((a: { tag: string }) => a.tag)).toEqual(["BR-10", "BR-11", "BR-12", "BR-13", "BR-14", "BR-15", "BR-16", "BR-17", "BR-18", "BR-19"]);
  });

  it("busca por raça e pelo nome da categoria da fazenda", async () => {
    await createAnimal(t.client, { tag: "X-1", sex: "FEMALE", category: "COW", breed: "Nelore" });
    await createAnimal(t.client, { tag: "X-2", sex: "MALE", category: "YEARLING", breed: "Angus" });
    expect((await list("?q=nelo")).items.map((a: { tag: string }) => a.tag)).toEqual(["X-1"]);
    expect((await list("?q=garrote")).items.map((a: { tag: string }) => a.tag)).toEqual(["X-2"]);
    await t.client.inject({ method: "PATCH", url: "/farm", payload: { categoryLabels: { YEARLING: "Novilho" } } });
    expect((await list("?q=novilho")).items.map((a: { tag: string }) => a.tag)).toEqual(["X-2"]);
  });

  it("brinco antigo encontra o animal (busca e brinco exato — critérios 12 e 21)", async () => {
    const animal = await createAnimal(t.client, { tag: "BR-104" });
    await t.client.inject({ method: "POST", url: `/animals/${animal.id}/tag-changes`, payload: { newTag: "BR-210", reason: "LOST", date: today() } });
    const byOld = await list("?q=BR-104");
    expect(byOld.items).toHaveLength(1);
    expect(byOld.items[0]).toMatchObject({ tag: "BR-210", previousTags: ["BR-104"] });
    expect((await list("?tag=br-104&status=ACTIVE")).items).toHaveLength(1);
    expect((await list("?tag=br-21")).items).toHaveLength(0); // exato, não "contém"
  });

  it("filtro por lote e 'sem lote'", async () => {
    const lot = await createLot("A");
    const [a] = [await createAnimal(t.client, { tag: "IN" }), await createAnimal(t.client, { tag: "OUT" })];
    await move(lot.id, [a.id], "2026-03-01");
    expect((await list(`?lotId=${lot.id}`)).items.map((x: { tag: string }) => x.tag)).toEqual(["IN"]);
    expect((await list("?lotId=none")).items.map((x: { tag: string }) => x.tag)).toEqual(["OUT"]);
    expect((await list()).items.find((x: { tag: string }) => x.tag === "IN").lot).toEqual({ id: lot.id, name: "A" });
  });

  it("parâmetros inválidos → 400", async () => {
    expect((await t.client.inject({ url: "/animals?pageSize=0" })).statusCode).toBe(400);
    expect((await t.client.inject({ url: "/animals?pageSize=5001" })).statusCode).toBe(400);
    expect((await t.client.inject({ url: "/animals?lotId=abc" })).statusCode).toBe(400);
  });
});

describe("pesagens: período do GMD e ganho desde a anterior (RN-PES-007/008)", () => {
  it("o GMD vem com as datas; o histórico com o ganho de cada intervalo", async () => {
    const animal = await createAnimal(t.client);
    await addWeighing(t.client, animal.id, "2024-06-01", 180);
    await addWeighing(t.client, animal.id, "2024-09-01", 240);
    await addWeighing(t.client, animal.id, "2024-12-01", 300);
    const gain = (await t.client.inject({ url: `/animals/${animal.id}/weight-gain` })).json();
    expect(gain).toMatchObject({ startDate: "2024-06-01", endDate: "2024-12-01", days: 183, averageDailyGainKg: 0.656 });
    const weighings = (await t.client.inject({ url: `/animals/${animal.id}/weighings` })).json();
    expect(weighings.map((w: { gainSincePrevious: unknown }) => w.gainSincePrevious)).toEqual([
      { gainKg: 60, days: 91, dailyGainKg: 0.659 },
      { gainKg: 60, days: 92, dailyGainKg: 0.652 },
      null,
    ]);
  });
});
