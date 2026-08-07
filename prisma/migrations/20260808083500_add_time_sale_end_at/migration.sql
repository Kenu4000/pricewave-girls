ALTER TABLE "Product" ADD COLUMN "timeSaleStartedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "timeSaleEndsAt" DATETIME;
ALTER TABLE "PriceHistory" ADD COLUMN "timeSaleEndsAt" DATETIME;

CREATE INDEX "Product_timeSaleEndsAt_idx" ON "Product"("timeSaleEndsAt");
CREATE INDEX "PriceHistory_timeSaleEndsAt_idx" ON "PriceHistory"("timeSaleEndsAt");

-- 過去のタイムセール検出漏れで PriceChange に残った「通常価格→セール価格」を除外する。
-- #26 で補正済みの PriceHistory と、同一商品・価格ペア・近接時刻が一致するものだけを対象にする。
DELETE FROM "PriceChange"
WHERE "type" = 'sale'
  AND EXISTS (
    SELECT 1
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = "PriceChange"."productId"
      AND "PriceHistory"."isTimeSale" = 1
      AND "PriceHistory"."regularSalePrice" = "PriceChange"."previousPrice"
      AND "PriceHistory"."salePrice" = "PriceChange"."currentPrice"
      AND ABS(
        CAST(strftime('%s', "PriceHistory"."checkedAt") AS INTEGER) -
        CAST(strftime('%s', "PriceChange"."changedAt") AS INTEGER)
      ) <= 600
  );
