-- Manejo sanitário completo (2026-10-18) — Espec — Manejo sanitário v1.0
-- D-39 tipos de produto · F-18 editar/arquivar · D-12 carência + aviso na venda
-- D-40 saída do lembrete · RN-SAN-013 dose · REQ-INT-02 envio repetido
-- Só acrescenta: nenhuma coluna ou dado existente é apagado.

-- 1) Nome de produto repetido (sem diferenciar maiúsculas) impede o índice
--    novo: para e diz quais (nada é alterado).
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(f || ': ' || names, '; ') INTO dup FROM (
    SELECT "farmId" AS f, string_agg(name, ', ') AS names
    FROM "Product" GROUP BY "farmId", lower(name) HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'RN-SAN-005: produtos com o mesmo nome (%). Renomeie um deles antes de migrar. Nada foi alterado.', dup;
  END IF;
END $$;

-- 2) Tipos
CREATE TYPE "DoseUnit" AS ENUM ('ML', 'G', 'DOSE');
ALTER TYPE "ProductType" ADD VALUE 'EXTERNAL_PARASITICIDE';
ALTER TYPE "ProductType" ADD VALUE 'OTHER';

-- 3) Produto
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "manufacturer" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "purpose" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "withdrawalDays" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_withdrawal_days_check"
  CHECK ("withdrawalDays" IS NULL OR ("withdrawalDays" >= 0 AND "withdrawalDays" <= 365));
CREATE UNIQUE INDEX "Product_farmId_lower_name_key" ON "Product" ("farmId", lower("name"));

-- 4) Aplicação
ALTER TABLE "Application" ADD COLUMN "batchNumber" TEXT,
ADD COLUMN "doseAmount" DECIMAL(10,3),
ADD COLUMN "doseUnit" "DoseUnit",
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "reappliesApplicationId" TEXT,
ADD COLUMN "reminderDismissReason" TEXT,
ADD COLUMN "reminderDismissedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "withdrawalDays" INTEGER,
ADD COLUMN "withdrawalEndDate" DATE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_dose_check"
  CHECK (("doseAmount" IS NULL) = ("doseUnit" IS NULL) AND ("doseAmount" IS NULL OR "doseAmount" > 0));
ALTER TABLE "Application" ADD CONSTRAINT "Application_withdrawal_check"
  CHECK (
    ("withdrawalDays" IS NULL AND "withdrawalEndDate" IS NULL)
    OR ("withdrawalDays" >= 0 AND "withdrawalEndDate" = "date" + "withdrawalDays")
  );
ALTER TABLE "Application" ADD CONSTRAINT "Application_dismiss_reason_check"
  CHECK ("reminderDismissReason" IS NULL OR "reminderDismissedAt" IS NOT NULL);
ALTER TABLE "Application" ADD CONSTRAINT "Application_not_self_reapply_check"
  CHECK ("reappliesApplicationId" IS NULL OR "reappliesApplicationId" <> "id");
CREATE INDEX "Application_reappliesApplicationId_idx" ON "Application"("reappliesApplicationId");
CREATE UNIQUE INDEX "Application_farmId_idempotencyKey_key" ON "Application"("farmId", "idempotencyKey");
ALTER TABLE "Application" ADD CONSTRAINT "Application_reappliesApplicationId_fkey" FOREIGN KEY ("reappliesApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Venda: guarda que o aviso de carência foi aceito
ALTER TABLE "Trade" ADD COLUMN "withdrawalWarningAccepted" BOOLEAN NOT NULL DEFAULT false;
