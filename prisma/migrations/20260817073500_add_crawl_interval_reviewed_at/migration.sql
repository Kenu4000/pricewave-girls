ALTER TABLE "Product" ADD COLUMN "crawlIntervalReviewedAt" DATETIME;

CREATE INDEX "Product_crawlIntervalDays_crawlIntervalReviewedAt_idx"
ON "Product"("crawlIntervalDays", "crawlIntervalReviewedAt");
