-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isTimeSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "previousIsTimeSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PriceHistory" ADD COLUMN "isTimeSale" BOOLEAN NOT NULL DEFAULT false;

-- The parser stores the current state in detailsJson so both Prisma nested writes
-- and the batched raw SQL path can share the same persistence behavior.
CREATE TRIGGER "Product_sync_time_sale_after_insert"
AFTER INSERT ON "Product"
BEGIN
  UPDATE "Product"
  SET
    "previousIsTimeSale" = 0,
    "isTimeSale" = CASE
      WHEN NEW."detailsJson" LIKE '%"__pricewaveTimeSale":"true"%' THEN 1
      ELSE 0
    END
  WHERE "id" = NEW."id";
END;

CREATE TRIGGER "Product_sync_time_sale_after_details_update"
AFTER UPDATE OF "detailsJson" ON "Product"
BEGIN
  UPDATE "Product"
  SET
    "previousIsTimeSale" = OLD."isTimeSale",
    "isTimeSale" = CASE
      WHEN NEW."detailsJson" LIKE '%"__pricewaveTimeSale":"true"%' THEN 1
      ELSE 0
    END
  WHERE "id" = NEW."id";
END;

CREATE TRIGGER "PriceHistory_copy_time_sale_after_insert"
AFTER INSERT ON "PriceHistory"
BEGIN
  UPDATE "PriceHistory"
  SET "isTimeSale" = COALESCE(
    (SELECT "isTimeSale" FROM "Product" WHERE "id" = NEW."productId"),
    0
  )
  WHERE "id" = NEW."id";
END;

-- Entering, remaining in, or leaving a time sale is a temporary sale-price
-- transition. It stays in PriceHistory but is omitted from PriceChange.
CREATE TRIGGER "PriceChange_skip_time_sale_sale_changes"
BEFORE INSERT ON "PriceChange"
WHEN NEW."type" = 'sale'
  AND EXISTS (
    SELECT 1
    FROM "Product"
    WHERE "id" = NEW."productId"
      AND ("isTimeSale" = 1 OR "previousIsTimeSale" = 1)
  )
BEGIN
  SELECT RAISE(IGNORE);
END;

-- Do not move the product-level normal-price changed timestamp for temporary
-- time-sale transitions. The actual current price is still updated.
CREATE TRIGGER "Product_restore_sale_changed_at_for_time_sale"
AFTER UPDATE OF "latestSalePrice", "detailsJson" ON "Product"
WHEN OLD."latestSalePrice" IS NOT NEW."latestSalePrice"
  AND (
    OLD."isTimeSale" = 1
    OR NEW."detailsJson" LIKE '%"__pricewaveTimeSale":"true"%'
  )
BEGIN
  UPDATE "Product"
  SET "salePriceChangedAt" = OLD."salePriceChangedAt"
  WHERE "id" = NEW."id";
END;
