import { describe, expect, it } from "vitest";
import { originFrom, safeInternalPath, sectionOf } from "./origin.js";

describe("safeInternalPath — só caminhos deste sistema", () => {
  it.each(["/", "/animais/1", "/?status=ACTIVE&page=2", "/negociacoes/nova?tipo=venda&animal=x"])("aceita %s", (path) => {
    expect(safeInternalPath(path)).toBe(path);
  });

  it.each([
    "https://outro.site",
    "//outro.site",
    "/\\outro.site",
    "animais/1",
    "",
    "/login",
    "/login?x=1",
    "/register",
    "javascript:alert(1)",
    123,
    null,
    undefined,
  ])("recusa %s", (path) => {
    expect(safeInternalPath(path)).toBeNull();
  });

  it("caminho grande demais é recusado", () => {
    expect(safeInternalPath(`/${"a".repeat(2001)}`)).toBeNull();
  });
});

describe("originFrom — de onde a tela foi aberta", () => {
  it("lê a marca deixada pela tela anterior", () => {
    expect(originFrom({ from: "/?page=2" })).toBe("/?page=2");
  });
  it("sem marca (link direto) ou marca estranha → sem origem", () => {
    expect(originFrom(null)).toBeNull();
    expect(originFrom(undefined)).toBeNull();
    expect(originFrom({})).toBeNull();
    expect(originFrom({ from: "https://x.y" })).toBeNull();
  });
});

describe("sectionOf — item do menu marcado", () => {
  it.each([
    ["/", "herd"],
    ["/animais/abc", "herd"],
    ["/animais/abc/editar", "herd"],
    ["/animais/novo", "addAnimal"],
    ["/manejo", "sanitary"],
    ["/produtos", "sanitary"],
    ["/aplicacoes/nova", "sanitary"],
    ["/aplicacoes/abc", "sanitary"],
    ["/negociacoes", "trades"],
    ["/negociacoes/abc/editar", "trades"],
    ["/configuracoes", "settings"],
    ["/pesagens", "herd"],
    ["/painel", "dashboard"],
    ["/lotes", "lots"],
    ["/lotes/abc", "lots"],
  ] as const)("%s → %s", (path, section) => {
    expect(sectionOf(path)).toBe(section);
  });

  it("endereço desconhecido não marca nada", () => {
    expect(sectionOf("/qualquer")).toBeNull();
    expect(sectionOf("/manejos")).toBeNull();
  });
});
