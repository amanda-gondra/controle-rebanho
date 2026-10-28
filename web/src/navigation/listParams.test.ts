import { describe, expect, it } from "vitest";
import { buildParams, pageWindow, readChoice, readPage, readText } from "./listParams.js";

const params = (query: string) => new URLSearchParams(query);

describe("filtros no endereço", () => {
  it("lê o que é válido e volta ao padrão no que não é", () => {
    expect(readChoice(params("status=SOLD"), "status", ["ALL", "ACTIVE", "SOLD"] as const, "ALL")).toBe("SOLD");
    expect(readChoice(params("status=HACK"), "status", ["ALL", "ACTIVE"] as const, "ALL")).toBe("ALL");
    expect(readChoice(params(""), "status", ["ALL"] as const, "ALL")).toBe("ALL");
  });

  it("página: inteiro de 1 em diante; o resto vira 1", () => {
    expect(readPage(params("page=3"))).toBe(3);
    for (const bad of ["page=0", "page=-2", "page=1.5", "page=abc", ""]) expect(readPage(params(bad))).toBe(1);
  });

  it("texto da busca com limite de tamanho", () => {
    expect(readText(params("q=BR-1"), "q")).toBe("BR-1");
    expect(readText(params(`q=${"x".repeat(300)}`), "q")).toHaveLength(100);
  });

  it("endereço sem os valores padrão", () => {
    const built = buildParams({ status: "ALL", q: "", page: 1, category: "COW" }, { status: "ALL", page: 1 });
    expect(built.toString()).toBe("category=COW");
  });
});

describe("pageWindow", () => {
  it("poucas páginas: todas", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("muitas páginas: primeira, vizinhas da atual, última", () => {
    expect(pageWindow(10, 40)).toEqual([1, null, 9, 10, 11, null, 40]);
    expect(pageWindow(1, 40)).toEqual([1, 2, null, 40]);
    expect(pageWindow(40, 40)).toEqual([1, null, 39, 40]);
  });
});
