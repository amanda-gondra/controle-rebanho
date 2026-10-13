-- G4 — Categorias (D-02) + castrado + nomes de categoria da fazenda (D-21).
--
-- Converte as categorias antigas SEM perder nenhum animal:
--   YEARLING (novilho) macho → YEARLING (garrote)
--   YEARLING (novilho) fêmea → HEIFER (novilha)
--   STEER (boi)              → ADULT_MALE (boi)
--   CALF e COW               → iguais
-- Tudo numa transação só: se algo falhar, nada muda no banco.

BEGIN;

-- 1) Segurança: categoria antiga que não combina com o sexo (ex.: "vaca" macho,
--    "boi" fêmea) não tem conversão automática certa. Se existir, a migration
--    PARA aqui, sem mudar nada, e diz quantos são — corrija esses animais
--    (sexo ou categoria) e rode de novo.
DO $$
DECLARE
  incompatible integer;
BEGIN
  SELECT count(*) INTO incompatible
  FROM "Animal"
  WHERE ("category"::text = 'COW' AND "sex" = 'MALE')
     OR ("category"::text = 'STEER' AND "sex" = 'FEMALE');

  IF incompatible > 0 THEN
    RAISE EXCEPTION 'G4: % animal(is) com categoria que não combina com o sexo (vaca macho ou boi fêmea). Corrija antes de migrar.', incompatible;
  END IF;
END $$;

-- 2) Troca o tipo da categoria, convertendo cada animal
CREATE TYPE "Category_new" AS ENUM ('CALF', 'HEIFER', 'COW', 'YEARLING', 'ADULT_MALE', 'BULL');

ALTER TABLE "Animal" ALTER COLUMN "category" TYPE "Category_new" USING (
  CASE
    WHEN "category"::text = 'YEARLING' AND "sex" = 'FEMALE' THEN 'HEIFER'
    WHEN "category"::text = 'STEER' THEN 'ADULT_MALE'
    ELSE "category"::text
  END
)::"Category_new";

ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "public"."Category_old";

-- 3) Castrado: só para machos. Os machos que já existem ficam "não castrado"
--    (o mesmo padrão da fazenda — D-21; na fazenda de origem os machos
--    geralmente não são castrados — V-02). Fêmeas ficam vazio.
ALTER TABLE "Animal" ADD COLUMN "castrated" BOOLEAN;
UPDATE "Animal" SET "castrated" = false WHERE "sex" = 'MALE';

-- 4) Nomes de categoria personalizados da fazenda (vazio = todos no padrão)
ALTER TABLE "Farm" ADD COLUMN "categoryLabels" JSONB NOT NULL DEFAULT '{}';

-- 5) Regras também no banco (defesa além da API — RN-ANIMAL-004 e 006)
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_category_sex_check" CHECK (
  "category" = 'CALF'
  OR ("category" IN ('HEIFER', 'COW') AND "sex" = 'FEMALE')
  OR ("category" IN ('YEARLING', 'ADULT_MALE', 'BULL') AND "sex" = 'MALE')
);
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_castrated_male_only_check" CHECK (
  "sex" = 'MALE' OR "castrated" IS NULL
);
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_categoryLabels_object_check" CHECK (
  jsonb_typeof("categoryLabels") = 'object'
);

COMMIT;
