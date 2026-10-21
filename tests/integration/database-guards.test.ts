import { describe, expect, it } from "vitest";
import { useTestApp } from "../helpers/suite.js";
import { prisma } from "../../src/lib/prisma.js";

// GUARDAS DO BANCO que o schema.prisma NÃO consegue descrever (índices por
// expressão/parciais e gatilhos), criados à mão nas migrations de 2026-10-18.
// O `prisma migrate dev` pode propor apagá-los numa migration futura, porque
// não os enxerga. Se uma migration fizer isso, este teste falha — e a regra
// de integridade (brinco único sem maiúsculas, um lote aberto por animal,
// trilha que não se edita) não some em silêncio. Ver docs/database.md.

useTestApp();

const REQUIRED_INDEXES = [
  "Animal_farmId_lower_tag_key",
  "Product_farmId_lower_name_key",
  "Lot_farmId_lower_name_key",
  "LotMembership_one_open_per_animal_key",
];
const REQUIRED_TRIGGERS = ["AuditLog_no_update", "LotMembership_same_farm"];

describe("guardas do banco fora do schema.prisma", () => {
  it("índices únicos por expressão e parciais existem", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`;
    const names = new Set(rows.map((row) => row.indexname));
    for (const index of REQUIRED_INDEXES) expect(names, index).toContain(index);
  });

  it("gatilhos existem", async () => {
    const rows = await prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger WHERE NOT tgisinternal`;
    const names = new Set(rows.map((row) => row.tgname));
    for (const trigger of REQUIRED_TRIGGERS) expect(names, trigger).toContain(trigger);
  });
});
