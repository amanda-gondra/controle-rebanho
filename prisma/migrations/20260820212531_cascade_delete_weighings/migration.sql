-- DropForeignKey
ALTER TABLE "Weighing" DROP CONSTRAINT "Weighing_animalId_fkey";

-- AddForeignKey
ALTER TABLE "Weighing" ADD CONSTRAINT "Weighing_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
