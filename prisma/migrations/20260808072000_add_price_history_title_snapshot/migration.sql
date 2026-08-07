-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN "titleSnapshot" TEXT;

-- Store the product title that was current when each price snapshot was inserted.
-- The UI derives the condition note from this historical title, so future title
-- changes do not rewrite old price-history condition labels.
CREATE TRIGGER "PriceHistory_copy_title_after_insert"
AFTER INSERT ON "PriceHistory"
BEGIN
  UPDATE "PriceHistory"
  SET "titleSnapshot" = (
    SELECT "title"
    FROM "Product"
    WHERE "id" = NEW."productId"
  )
  WHERE "id" = NEW."id";
END;
