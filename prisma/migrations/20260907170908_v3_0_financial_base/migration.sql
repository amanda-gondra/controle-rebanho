-- AlterTable
ALTER TABLE "Animal" ADD COLUMN     "estimatedPricePerKg" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "AnimalPurchase" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalSale" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPurchase_animalId_key" ON "AnimalPurchase"("animalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalSale_animalId_key" ON "AnimalSale"("animalId");

-- AddForeignKey
ALTER TABLE "AnimalPurchase" ADD CONSTRAINT "AnimalPurchase_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSale" ADD CONSTRAINT "AnimalSale_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
