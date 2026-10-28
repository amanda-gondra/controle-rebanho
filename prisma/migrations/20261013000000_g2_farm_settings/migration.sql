-- G2 — Configurações da fazenda (D-21, D-30). Só ADICIONA colunas, todas com
-- valor padrão: nenhuma fazenda existente muda e nada precisa ser preenchido.

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PER_KG', 'PER_ARROBA', 'PER_HEAD');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "arrobaLiveFactorKg" DECIMAL(4,2) NOT NULL DEFAULT 30,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "defaultCastrated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredPriceUnit" "PriceUnit" NOT NULL DEFAULT 'PER_KG',
ADD COLUMN     "reapplyAlertDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "weightUnit" TEXT NOT NULL DEFAULT 'kg';

-- Limites também no banco (defesa em profundidade): mesmo que algum código
-- futuro esqueça a validação da API, o banco não aceita valor fora da regra.
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_arrobaLiveFactorKg_check"
  CHECK ("arrobaLiveFactorKg" > 0);
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_reapplyAlertDays_check"
  CHECK ("reapplyAlertDays" BETWEEN 0 AND 60);
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_currency_check"
  CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_weightUnit_check"
  CHECK ("weightUnit" IN ('kg', 'lb'));
