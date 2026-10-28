import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv.js";

describe("CSV para o Excel", () => {
  it("separa por ponto e vírgula, com BOM e \\r\\n", () => {
    expect(toCsv(["Brinco", "Peso"], [["A-1", 420.5]])).toBe("﻿Brinco;Peso\r\nA-1;420.5\r\n");
  });

  it("aspas quando o texto tem ; aspas ou quebra de linha", () => {
    expect(csvCell('Nelore; "PO"')).toBe('"Nelore; ""PO"""');
    expect(csvCell("linha\nnova")).toBe('"linha\nnova"');
  });

  it("vazio para nulo", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("texto que parece fórmula não vira fórmula", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+55")).toBe("'+55");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@soma")).toBe("'@soma");
    // números de verdade (peso negativo não existe, mas) ficam como número
    expect(csvCell(-1)).toBe("-1");
  });
});
