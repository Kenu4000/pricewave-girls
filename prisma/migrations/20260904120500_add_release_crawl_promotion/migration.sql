ALTER TABLE "Product" ADD COLUMN "releaseCrawlPromotedForDate" TEXT;

CREATE INDEX "Product_releaseCrawlPromotedForDate_idx"
ON "Product"("releaseCrawlPromotedForDate");
