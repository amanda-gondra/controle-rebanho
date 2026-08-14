-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MACHO', 'FEMEA');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('BEZERRO', 'NOVILHO', 'BOI', 'VACA');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ATIVO', 'VENDIDO', 'MORTO');

-- CreateEnum
CREATE TYPE "PrecisaoNascimento" AS ENUM ('DIA_MES_ANO', 'MES_ANO', 'DESCONHECIDA');

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "brinco" TEXT NOT NULL,
    "sexo" "Sexo" NOT NULL,
    "raca" TEXT,
    "categoria" "Categoria" NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ATIVO',
    "dataNascimento" TIMESTAMP(3),
    "precisaoNascimento" "PrecisaoNascimento" NOT NULL DEFAULT 'DESCONHECIDA',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pesagem" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "pesoKg" DECIMAL(6,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pesagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Animal_brinco_key" ON "Animal"("brinco");

-- AddForeignKey
ALTER TABLE "Pesagem" ADD CONSTRAINT "Pesagem_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
