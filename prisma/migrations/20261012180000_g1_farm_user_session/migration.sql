-- G1 — Fazenda, usuário, sessão e separação dos dados por fazenda (farmId).
--
-- Gerada pelo Prisma e AJUSTADA à mão em um ponto: as tabelas do rebanho já podem
-- ter linhas (dados de teste do protótipo). Por isso o farmId entra em 3 passos:
--   1) coluna opcional  2) preenchida com a "fazenda inicial"  3) vira obrigatória.
-- Nada é apagado. Num banco vazio (teste, CI, produção nova) a fazenda inicial
-- NÃO é criada.
--
-- Também converte as datas de calendário para DATE (sem hora — F-17). As datas
-- existentes estão à meia-noite UTC, então a conversão não muda nenhum dia.

-- 1. Novas tabelas de conta -------------------------------------------------

CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- 2. Fazenda inicial: só se o banco já tem dados do protótipo ---------------

INSERT INTO "Farm" ("id", "name", "updatedAt")
SELECT '00000000-0000-4000-8000-000000000001', 'Fazenda inicial (dados do protótipo)', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Animal")
   OR EXISTS (SELECT 1 FROM "Product")
   OR EXISTS (SELECT 1 FROM "Application");

-- 3. farmId em todas as tabelas do rebanho (opcional → preenchido → obrigatório)

ALTER TABLE "Animal"            ADD COLUMN "farmId" TEXT;
ALTER TABLE "Weighing"          ADD COLUMN "farmId" TEXT;
ALTER TABLE "Product"           ADD COLUMN "farmId" TEXT;
ALTER TABLE "Application"       ADD COLUMN "farmId" TEXT;
ALTER TABLE "ApplicationAnimal" ADD COLUMN "farmId" TEXT;
ALTER TABLE "AnimalPurchase"    ADD COLUMN "farmId" TEXT;
ALTER TABLE "AnimalSale"        ADD COLUMN "farmId" TEXT;

UPDATE "Animal"            SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Weighing"          SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Product"           SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "Application"       SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "ApplicationAnimal" SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "AnimalPurchase"    SET "farmId" = '00000000-0000-4000-8000-000000000001';
UPDATE "AnimalSale"        SET "farmId" = '00000000-0000-4000-8000-000000000001';

ALTER TABLE "Animal"            ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "Weighing"          ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "Product"           ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "Application"       ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "ApplicationAnimal" ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "AnimalPurchase"    ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "AnimalSale"        ALTER COLUMN "farmId" SET NOT NULL;

-- 4. Datas de calendário sem hora (F-17) ------------------------------------

ALTER TABLE "Animal"         ALTER COLUMN "birthDate"   SET DATA TYPE DATE USING "birthDate"::date;
ALTER TABLE "Weighing"       ALTER COLUMN "date"        SET DATA TYPE DATE USING "date"::date;
ALTER TABLE "Application"    ALTER COLUMN "date"        SET DATA TYPE DATE USING "date"::date,
                             ALTER COLUMN "reapplyDate" SET DATA TYPE DATE USING "reapplyDate"::date;
ALTER TABLE "AnimalPurchase" ALTER COLUMN "date"        SET DATA TYPE DATE USING "date"::date;
ALTER TABLE "AnimalSale"     ALTER COLUMN "date"        SET DATA TYPE DATE USING "date"::date;

-- 5. Brinco único POR FAZENDA (antes: único no sistema todo) -----------------

DROP INDEX "Animal_tag_key";
CREATE UNIQUE INDEX "Animal_farmId_tag_key" ON "Animal"("farmId", "tag");

-- 6. Índices ----------------------------------------------------------------

CREATE UNIQUE INDEX "User_farmId_key" ON "User"("farmId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Animal_farmId_status_idx" ON "Animal"("farmId", "status");
CREATE INDEX "AnimalPurchase_farmId_idx" ON "AnimalPurchase"("farmId");
CREATE INDEX "AnimalSale_farmId_idx" ON "AnimalSale"("farmId");
CREATE INDEX "Application_farmId_date_idx" ON "Application"("farmId", "date");
CREATE INDEX "Application_farmId_reapplyDate_idx" ON "Application"("farmId", "reapplyDate");
CREATE INDEX "Application_productId_idx" ON "Application"("productId");
CREATE INDEX "ApplicationAnimal_animalId_idx" ON "ApplicationAnimal"("animalId");
CREATE INDEX "ApplicationAnimal_farmId_idx" ON "ApplicationAnimal"("farmId");
CREATE INDEX "Product_farmId_type_idx" ON "Product"("farmId", "type");
CREATE INDEX "Weighing_animalId_date_idx" ON "Weighing"("animalId", "date");
CREATE INDEX "Weighing_farmId_idx" ON "Weighing"("farmId");

-- 7. Chaves estrangeiras ----------------------------------------------------

ALTER TABLE "User" ADD CONSTRAINT "User_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Weighing" ADD CONSTRAINT "Weighing_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnimal" ADD CONSTRAINT "ApplicationAnimal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnimalPurchase" ADD CONSTRAINT "AnimalPurchase_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnimalSale" ADD CONSTRAINT "AnimalSale_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
