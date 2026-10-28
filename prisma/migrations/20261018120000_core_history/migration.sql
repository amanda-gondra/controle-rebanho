-- Histórico do animal e autoria (2026-10-18)
-- D-29 brinco sem diferenciar maiúsculas · D-19 troca de brinco · D-28 linha do tempo
-- D-51 autor + trilha de ações sensíveis · D-52 origem e data de entrada
-- Só acrescenta: nenhuma coluna ou dado existente é apagado.

-- 1) Antes de tudo: brincos que só diferem por maiúscula/minúscula na mesma
--    fazenda impedem o índice novo. Para e diz quais (nada é alterado).
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(f || ': ' || tags, '; ') INTO dup FROM (
    SELECT "farmId" AS f, string_agg(tag, ', ') AS tags
    FROM "Animal" GROUP BY "farmId", lower(tag) HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'D-29: brincos repetidos sem diferenciar maiúsculas (%). Troque um deles antes de migrar. Nada foi alterado.', dup;
  END IF;
END $$;

-- 2) Tipos novos
CREATE TYPE "AnimalOrigin" AS ENUM ('BORN_ON_FARM', 'PURCHASED', 'RECEIVED', 'NOT_INFORMED');
CREATE TYPE "AnimalEventType" AS ENUM ('TAG_CHANGED', 'CATEGORY_CHANGED', 'SEX_CHANGED', 'BIRTH_CHANGED', 'STATUS_CHANGED', 'ORIGIN_CHANGED', 'LOT_CHANGED');
CREATE TYPE "TagChangeReason" AS ENUM ('LOST', 'DAMAGED', 'TYPO', 'OTHER');

-- 3) Animal: origem, entrada e quem cadastrou
ALTER TABLE "Animal" ADD COLUMN "origin" "AnimalOrigin" NOT NULL DEFAULT 'NOT_INFORMED';
ALTER TABLE "Animal" ADD COLUMN "entryDate" DATE;
ALTER TABLE "Animal" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_entry_after_birth_check"
  CHECK ("entryDate" IS NULL OR "birthDate" IS NULL OR "entryDate" >= "birthDate");
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_entry_before_exit_check"
  CHECK ("entryDate" IS NULL OR "exitDate" IS NULL OR "entryDate" <= "exitDate");

-- Animais que já têm compra registrada: origem "comprado", entrada = data da compra
UPDATE "Animal" a SET "origin" = 'PURCHASED', "entryDate" = t."date"
FROM "TradeItem" ti JOIN "Trade" t ON t."id" = ti."tradeId"
WHERE ti."animalId" = a."id" AND ti."type" = 'PURCHASE'
  AND (a."birthDate" IS NULL OR t."date" >= a."birthDate")
  AND (a."exitDate" IS NULL OR t."date" <= a."exitDate");

-- 4) Brinco único por fazenda SEM diferenciar maiúsculas (o índice antigo fica)
CREATE UNIQUE INDEX "Animal_farmId_lower_tag_key" ON "Animal" ("farmId", lower("tag"));

-- 5) Autor das pesagens e aplicações
ALTER TABLE "Weighing" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Weighing" ADD CONSTRAINT "Weighing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Application" ADD CONSTRAINT "Application_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6) Linha do tempo do animal
CREATE TABLE "AnimalEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "AnimalEventType" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "reason" "TagChangeReason",
    "effectiveDate" DATE NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence" SERIAL NOT NULL,
    CONSTRAINT "AnimalEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnimalEvent_reason_check" CHECK (("type" = 'TAG_CHANGED') = ("reason" IS NOT NULL))
);
CREATE INDEX "AnimalEvent_animalId_createdAt_idx" ON "AnimalEvent"("animalId", "createdAt");
CREATE INDEX "AnimalEvent_farmId_type_fromValue_idx" ON "AnimalEvent"("farmId", "type", "fromValue");
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7) Trilha de ações sensíveis (só acrescentada)
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_farmId_createdAt_idx" ON "AuditLog"("farmId", "createdAt");
CREATE INDEX "AuditLog_farmId_entityType_entityId_idx" ON "AuditLog"("farmId", "entityType", "entityId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A trilha não se edita: UPDATE é recusado no banco (o SET NULL do autor,
-- quando um usuário some, é a única mudança aceita)
CREATE FUNCTION "audit_log_no_update"() RETURNS trigger AS $$
BEGIN
  IF NEW."farmId" IS DISTINCT FROM OLD."farmId" OR NEW."action" IS DISTINCT FROM OLD."action"
     OR NEW."entityType" IS DISTINCT FROM OLD."entityType" OR NEW."entityId" IS DISTINCT FROM OLD."entityId"
     OR NEW."details" IS DISTINCT FROM OLD."details" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (NEW."userId" IS DISTINCT FROM OLD."userId" AND NEW."userId" IS NOT NULL) THEN
    RAISE EXCEPTION 'AuditLog é só acrescentado; não pode ser alterado.';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditLog_no_update" BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_no_update"();
