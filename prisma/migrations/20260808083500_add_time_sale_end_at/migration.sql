ALTER TABLE "Product" ADD COLUMN "timeSaleEndsAt" DATETIME;
ALTER TABLE "PriceHistory" ADD COLUMN "timeSaleEndsAt" DATETIME;

CREATE INDEX "Product_timeSaleEndsAt_idx" ON "Product"("timeSaleEndsAt");
CREATE INDEX "PriceHistory_timeSaleEndsAt_idx" ON "PriceHistory"("timeSaleEndsAt");
