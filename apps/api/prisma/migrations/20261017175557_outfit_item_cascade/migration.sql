-- DropForeignKey
ALTER TABLE "OutfitItem" DROP CONSTRAINT "OutfitItem_clothingItemId_fkey";

-- AddForeignKey
ALTER TABLE "OutfitItem" ADD CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
