/*
  Warnings:

  - The values [ATIVO,VENDIDO,MORTO] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `atualizadoEm` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `brinco` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `categoria` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `criadoEm` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `dataNascimento` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `observacoes` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `precisaoNascimento` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `raca` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the column `sexo` on the `Animal` table. All the data in the column will be lost.
  - You are about to drop the `Pesagem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tag]` on the table `Animal` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `category` to the `Animal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sex` to the `Animal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tag` to the `Animal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Animal` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('CALF', 'YEARLING', 'STEER', 'COW');

-- CreateEnum
CREATE TYPE "BirthDatePrecision" AS ENUM ('DAY_MONTH_YEAR', 'MONTH_YEAR', 'UNKNOWN');

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('ACTIVE', 'SOLD', 'DEAD');
ALTER TABLE "public"."Animal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Animal" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "Animal" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Pesagem" DROP CONSTRAINT "Pesagem_animalId_fkey";

-- DropIndex
DROP INDEX "Animal_brinco_key";

-- AlterTable
ALTER TABLE "Animal" DROP COLUMN "atualizadoEm",
DROP COLUMN "brinco",
DROP COLUMN "categoria",
DROP COLUMN "criadoEm",
DROP COLUMN "dataNascimento",
DROP COLUMN "observacoes",
DROP COLUMN "precisaoNascimento",
DROP COLUMN "raca",
DROP COLUMN "sexo",
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "birthPrecision" "BirthDatePrecision" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "breed" TEXT,
ADD COLUMN     "category" "Category" NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sex" "Sex" NOT NULL,
ADD COLUMN     "tag" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "Pesagem";

-- DropEnum
DROP TYPE "Categoria";

-- DropEnum
DROP TYPE "PrecisaoNascimento";

-- DropEnum
DROP TYPE "Sexo";

-- CreateTable
CREATE TABLE "Weighing" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Weighing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_tag_key" ON "Animal"("tag");

-- AddForeignKey
ALTER TABLE "Weighing" ADD CONSTRAINT "Weighing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
