-- AlterTable
ALTER TABLE "Product" ADD COLUMN "managementNumber" TEXT;
ALTER TABLE "Product" ADD COLUMN "manufacturer" TEXT;
ALTER TABLE "Product" ADD COLUMN "releaseDate" TEXT;
ALTER TABLE "Product" ADD COLUMN "listPrice" INTEGER;
ALTER TABLE "Product" ADD COLUMN "modelNumber" TEXT;
ALTER TABLE "Product" ADD COLUMN "category" TEXT;
ALTER TABLE "Product" ADD COLUMN "detailsJson" TEXT;

-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "Product"("updatedAt");
CREATE INDEX "Product_title_idx" ON "Product"("title");
CREATE INDEX "Product_latestSalePrice_idx" ON "Product"("latestSalePrice");
CREATE INDEX "Product_latestBuyPrice_idx" ON "Product"("latestBuyPrice");
CREATE INDEX "Product_releaseDate_idx" ON "Product"("releaseDate");
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");
