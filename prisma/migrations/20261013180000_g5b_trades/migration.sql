-- G5 / entrega 2 — Negociações (compra e venda) no modelo definitivo:
-- Trade (uma negociação) + TradeItem (um animal dentro dela). D-03, D-06,
-- D-07, D-08, D-09, D-10, D-21, D-22.
--
-- Sem BEGIN/COMMIT de propósito: o Prisma manda o arquivo inteiro de uma vez
-- e o PostgreSQL executa tudo como UMA transação. Se qualquer passo falhar,
-- nada muda no banco — e a mensagem de erro aparece como foi escrita aqui.

-- 1) Segurança: os dados antigos precisam caber nas regras novas. Se não
--    couberem, PARA aqui sem mudar nada e diz quantos são.
DO $$
DECLARE
  invalid integer;
BEGIN
  SELECT
    (SELECT count(*) FROM "AnimalPurchase" WHERE "weightKg" <= 0 OR "pricePerKg" <= 0) +
    (SELECT count(*) FROM "AnimalSale" WHERE "weightKg" <= 0 OR "pricePerKg" <= 0)
  INTO invalid;

  IF invalid > 0 THEN
    RAISE EXCEPTION 'G5b: % compra(s)/venda(s) antigas com peso ou preço zero ou negativo. Corrija antes de migrar.', invalid;
  END IF;
END $$;

-- 2) Tipos e tabelas novas
CREATE TYPE "TradeType" AS ENUM ('PURCHASE', 'SALE');
CREATE TYPE "ArrobaBasis" AS ENUM ('CARCASS', 'LIVE_FACTOR');

CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "date" DATE NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL,
    "arrobaBasis" "ArrobaBasis",
    "arrobaFactorKg" DECIMAL(4,2),
    "currency" TEXT NOT NULL,
    "counterparty" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "type" "TradeType" NOT NULL,
    "animalId" TEXT NOT NULL,
    "liveWeightKg" DECIMAL(6,2),
    "carcassWeightKg" DECIMAL(6,2),
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "priceAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "value" DECIMAL(14,2),
    "weighingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Trade_farmId_date_idx" ON "Trade"("farmId", "date");
CREATE UNIQUE INDEX "Trade_id_type_key" ON "Trade"("id", "type");
CREATE UNIQUE INDEX "Trade_farmId_idempotencyKey_key" ON "Trade"("farmId", "idempotencyKey");
CREATE UNIQUE INDEX "TradeItem_weighingId_key" ON "TradeItem"("weighingId");
CREATE INDEX "TradeItem_tradeId_idx" ON "TradeItem"("tradeId");
CREATE INDEX "TradeItem_farmId_idx" ON "TradeItem"("farmId");
CREATE UNIQUE INDEX "TradeItem_animalId_type_key" ON "TradeItem"("animalId", "type");

ALTER TABLE "Trade" ADD CONSTRAINT "Trade_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_type_fkey" FOREIGN KEY ("tradeId", "type") REFERENCES "Trade"("id", "type") ON DELETE CASCADE ON UPDATE CASCADE;
-- D-10 / F-05: animal com negociação não pode ser apagado
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_weighingId_fkey" FOREIGN KEY ("weighingId") REFERENCES "Weighing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Compras e vendas do protótipo viram negociações de UM animal, por kg, na
--    moeda da fazenda, com o mesmo valor (peso × preço, arredondado a centavos).
--    A negociação reaproveita o id do registro antigo (rastreável).
INSERT INTO "Trade" ("id", "farmId", "type", "date", "priceUnit", "currency", "notes", "createdById", "createdAt", "updatedAt")
SELECT p."id", p."farmId", 'PURCHASE', p."date", 'PER_KG', f."currency", p."notes",
       (SELECT u."id" FROM "User" u WHERE u."farmId" = p."farmId"), p."createdAt", CURRENT_TIMESTAMP
FROM "AnimalPurchase" p JOIN "Farm" f ON f."id" = p."farmId";

INSERT INTO "Trade" ("id", "farmId", "type", "date", "priceUnit", "currency", "notes", "createdById", "createdAt", "updatedAt")
SELECT s."id", s."farmId", 'SALE', s."date", 'PER_KG', f."currency", s."notes",
       (SELECT u."id" FROM "User" u WHERE u."farmId" = s."farmId"), s."createdAt", CURRENT_TIMESTAMP
FROM "AnimalSale" s JOIN "Farm" f ON f."id" = s."farmId";

INSERT INTO "TradeItem" ("id", "farmId", "tradeId", "type", "animalId", "liveWeightKg", "unitPrice", "value", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."farmId", p."id", 'PURCHASE', p."animalId", p."weightKg", p."pricePerKg",
       round(p."weightKg" * p."pricePerKg", 2), p."createdAt", CURRENT_TIMESTAMP
FROM "AnimalPurchase" p;

INSERT INTO "TradeItem" ("id", "farmId", "tradeId", "type", "animalId", "liveWeightKg", "unitPrice", "value", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."farmId", s."id", 'SALE', s."animalId", s."weightKg", s."pricePerKg",
       round(s."weightKg" * s."pricePerKg", 2), s."createdAt", CURRENT_TIMESTAMP
FROM "AnimalSale" s;

-- 4) O peso da compra/venda vira pesagem (D-08) — só quando o animal ainda não
--    tem pesagem nesse dia (nenhuma pesagem existente é alterada aqui) e a data
--    está dentro da vida dele (RN-PES-004). Compras primeiro, depois vendas.
INSERT INTO "Weighing" ("id", "farmId", "animalId", "date", "weightKg", "source", "createdAt")
SELECT gen_random_uuid()::text, i."farmId", i."animalId", t."date", i."liveWeightKg", 'PURCHASE', CURRENT_TIMESTAMP
FROM "TradeItem" i
JOIN "Trade" t ON t."id" = i."tradeId"
JOIN "Animal" a ON a."id" = i."animalId"
WHERE i."type" = 'PURCHASE'
  AND (a."exitDate" IS NULL OR t."date" <= a."exitDate")
  AND NOT (a."birthPrecision" = 'DAY_MONTH_YEAR' AND a."birthDate" IS NOT NULL AND t."date" < a."birthDate")
  AND NOT EXISTS (SELECT 1 FROM "Weighing" w WHERE w."animalId" = i."animalId" AND w."date" = t."date");

INSERT INTO "Weighing" ("id", "farmId", "animalId", "date", "weightKg", "source", "createdAt")
SELECT gen_random_uuid()::text, i."farmId", i."animalId", t."date", i."liveWeightKg", 'SALE', CURRENT_TIMESTAMP
FROM "TradeItem" i
JOIN "Trade" t ON t."id" = i."tradeId"
JOIN "Animal" a ON a."id" = i."animalId"
WHERE i."type" = 'SALE'
  AND NOT (a."birthPrecision" = 'DAY_MONTH_YEAR' AND a."birthDate" IS NOT NULL AND t."date" < a."birthDate")
  AND NOT EXISTS (SELECT 1 FROM "Weighing" w WHERE w."animalId" = i."animalId" AND w."date" = t."date");

UPDATE "TradeItem" i
SET "weighingId" = w."id"
FROM "Trade" t, "Weighing" w
WHERE t."id" = i."tradeId"
  AND w."animalId" = i."animalId"
  AND w."date" = t."date"
  AND w."source"::text = i."type"::text;

-- 5) Conferência antes de apagar o que é antigo: cada compra e cada venda
--    precisa ter virado exatamente uma negociação com o mesmo valor.
DO $$
DECLARE
  old_count integer;
  new_count integer;
  old_total numeric;
  new_total numeric;
BEGIN
  SELECT (SELECT count(*) FROM "AnimalPurchase") + (SELECT count(*) FROM "AnimalSale") INTO old_count;
  SELECT count(*) FROM "TradeItem" INTO new_count;
  SELECT coalesce((SELECT sum(round("weightKg" * "pricePerKg", 2)) FROM "AnimalPurchase"), 0)
       + coalesce((SELECT sum(round("weightKg" * "pricePerKg", 2)) FROM "AnimalSale"), 0) INTO old_total;
  SELECT coalesce(sum("value"), 0) FROM "TradeItem" INTO new_total;

  IF old_count <> new_count OR old_total <> new_total THEN
    RAISE EXCEPTION 'G5b: a conversão não bateu (% registros antigos, % novos). Nada foi alterado.', old_count, new_count;
  END IF;
END $$;

-- 6) Sai o modelo antigo (os dados já estão nas negociações) e o valor
--    estimado do animal vivo (D-09: fora da 1.0).
ALTER TABLE "AnimalPurchase" DROP CONSTRAINT "AnimalPurchase_animalId_fkey";
ALTER TABLE "AnimalPurchase" DROP CONSTRAINT "AnimalPurchase_farmId_fkey";
ALTER TABLE "AnimalSale" DROP CONSTRAINT "AnimalSale_animalId_fkey";
ALTER TABLE "AnimalSale" DROP CONSTRAINT "AnimalSale_farmId_fkey";
DROP TABLE "AnimalPurchase";
DROP TABLE "AnimalSale";
ALTER TABLE "Animal" DROP COLUMN "estimatedPricePerKg";

-- 7) Regras também no banco (defesa extra; a API confere antes)
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_arroba_basis_check"
  CHECK (("priceUnit" = 'PER_ARROBA') = ("arrobaBasis" IS NOT NULL));
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_arroba_factor_check"
  CHECK (
    ("arrobaBasis" = 'LIVE_FACTOR' AND "arrobaFactorKg" > 0)
    OR ("arrobaBasis" IS DISTINCT FROM 'LIVE_FACTOR' AND "arrobaFactorKg" IS NULL)
  );
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_currency_check" CHECK (char_length("currency") = 3);
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_amounts_check"
  CHECK (
    "unitPrice" > 0
    AND ("liveWeightKg" IS NULL OR "liveWeightKg" > 0)
    AND ("carcassWeightKg" IS NULL OR "carcassWeightKg" > 0)
    AND ("carcassWeightKg" IS NULL OR "liveWeightKg" IS NULL OR "carcassWeightKg" <= "liveWeightKg")
    AND ("value" IS NULL OR "value" >= 0)
  );
