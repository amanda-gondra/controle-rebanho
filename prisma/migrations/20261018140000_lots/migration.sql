-- Lotes simples (D-49, aprovado em 2026-10-18): lote + períodos de cada
-- animal no lote (entrada/saída com data). Só acrescenta tabelas.




-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotMembership" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lot_farmId_idx" ON "Lot"("farmId");

-- CreateIndex
CREATE INDEX "LotMembership_lotId_endDate_idx" ON "LotMembership"("lotId", "endDate");

-- CreateIndex
CREATE INDEX "LotMembership_animalId_startDate_idx" ON "LotMembership"("animalId", "startDate");

-- CreateIndex
CREATE INDEX "LotMembership_farmId_idx" ON "LotMembership"("farmId");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMembership" ADD CONSTRAINT "LotMembership_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMembership" ADD CONSTRAINT "LotMembership_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMembership" ADD CONSTRAINT "LotMembership_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotMembership" ADD CONSTRAINT "LotMembership_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Nome do lote único na fazenda sem diferenciar maiúsculas
CREATE UNIQUE INDEX "Lot_farmId_lower_name_key" ON "Lot" ("farmId", lower("name"));

-- No máximo UM período aberto por animal (um lote por vez)
CREATE UNIQUE INDEX "LotMembership_one_open_per_animal_key" ON "LotMembership" ("animalId") WHERE "endDate" IS NULL;

-- Saída do lote nunca antes da entrada
ALTER TABLE "LotMembership" ADD CONSTRAINT "LotMembership_dates_check"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- Lote e animal do período são da MESMA fazenda do período (defesa no banco,
-- além do filtro por fazenda da API)
CREATE FUNCTION "lot_membership_same_farm"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Lot" WHERE "id" = NEW."lotId" AND "farmId" = NEW."farmId")
     OR NOT EXISTS (SELECT 1 FROM "Animal" WHERE "id" = NEW."animalId" AND "farmId" = NEW."farmId") THEN
    RAISE EXCEPTION 'LotMembership: lote e animal precisam ser da mesma fazenda.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "LotMembership_same_farm" BEFORE INSERT OR UPDATE ON "LotMembership"
  FOR EACH ROW EXECUTE FUNCTION "lot_membership_same_farm"();
