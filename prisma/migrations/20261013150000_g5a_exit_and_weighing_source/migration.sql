-- G5 / entrega 1 — Saída do animal (D-27) e origem da pesagem + uma por dia
-- (D-08, D-33). Tudo numa transação: se algo falhar, nada muda no banco.

BEGIN;

-- 1) Segurança: o banco passa a aceitar UMA pesagem por animal por dia (D-33).
--    Se já existirem duas no mesmo dia, a migration PARA aqui, sem mudar nada,
--    e diz quantos casos há. Nada é apagado automaticamente: corrija (exclua
--    ou mude a data de uma das duas) e rode de novo.
DO $$
DECLARE
  duplicated integer;
BEGIN
  SELECT count(*) INTO duplicated FROM (
    SELECT "animalId", "date" FROM "Weighing" GROUP BY "animalId", "date" HAVING count(*) > 1
  ) AS d;

  IF duplicated > 0 THEN
    RAISE EXCEPTION 'G5a: % dia(s) com mais de uma pesagem do mesmo animal. Deixe só uma por dia antes de migrar.', duplicated;
  END IF;
END $$;

CREATE TYPE "DeathCauseCertainty" AS ENUM ('CONFIRMED', 'SUSPECTED', 'NOT_INFORMED');
CREATE TYPE "WeighingSource" AS ENUM ('MANUAL', 'PURCHASE', 'SALE');

-- 2) Saída do animal
ALTER TABLE "Animal" ADD COLUMN "exitDate" DATE,
ADD COLUMN "deathCause" TEXT,
ADD COLUMN "deathCauseCertainty" "DeathCauseCertainty";

-- Vendidos que já têm a venda registrada: a data de saída é a da venda.
-- Vendidos "na mão" e mortos antigos ficam sem data ("não informada").
UPDATE "Animal" AS a SET "exitDate" = s."date"
FROM "AnimalSale" AS s
WHERE s."animalId" = a."id" AND a."status" = 'SOLD';

UPDATE "Animal" SET "deathCauseCertainty" = 'NOT_INFORMED' WHERE "status" = 'DEAD';

-- 3) Origem da pesagem; todas as que existem foram digitadas (manual)
ALTER TABLE "Weighing" ADD COLUMN "source" "WeighingSource" NOT NULL DEFAULT 'MANUAL';

-- 4) Uma pesagem por animal por dia (substitui o índice comum)
DROP INDEX "Weighing_animalId_date_idx";
CREATE UNIQUE INDEX "Weighing_animalId_date_key" ON "Weighing"("animalId", "date");

-- 5) Regras também no banco (defesa além da API)
--    Animal ativo não tem saída; causa e certeza só existem na morte.
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_active_without_exit_check"
  CHECK ("status" <> 'ACTIVE' OR "exitDate" IS NULL);
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_death_fields_check"
  CHECK ("status" = 'DEAD' OR ("deathCause" IS NULL AND "deathCauseCertainty" IS NULL));
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_deathCause_length_check"
  CHECK ("deathCause" IS NULL OR char_length("deathCause") <= 200);

COMMIT;
