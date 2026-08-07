-- AlterTable
ALTER TABLE "Product" ADD COLUMN "condition" TEXT;
ALTER TABLE "Product" ADD COLUMN "conditionRank" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "Product" ADD COLUMN "latestRegularSalePrice" INTEGER;

ALTER TABLE "PriceHistory" ADD COLUMN "condition" TEXT;
ALTER TABLE "PriceHistory" ADD COLUMN "conditionRank" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "PriceHistory" ADD COLUMN "regularSalePrice" INTEGER;

-- Existing ordinary-price rows already know their own regular price.
UPDATE "Product"
SET "latestRegularSalePrice" = "latestSalePrice"
WHERE "isTimeSale" = 0;

UPDATE "PriceHistory"
SET "regularSalePrice" = "salePrice"
WHERE "isTimeSale" = 0;

-- Backfill the state-annotated titles that were stored before the title/state
-- split was introduced. Nested parentheses inside the state text are safe here
-- because the start marker and final closing parenthesis define the range.
UPDATE "Product"
SET
  "condition" = trim(substr(
    "title",
    instr("title", '(状態：') + 4,
    length("title") - (instr("title", '(状態：') + 4)
  )),
  "conditionRank" = 'B',
  "title" = trim(substr("title", 1, instr("title", '(状態：') - 1))
WHERE instr("title", '(状態：') > 0
  AND substr(trim("title"), -1, 1) = ')';

UPDATE "Product"
SET
  "condition" = trim(substr(
    "title",
    instr("title", '（状態：') + 4,
    length("title") - (instr("title", '（状態：') + 4)
  )),
  "conditionRank" = 'B',
  "title" = trim(substr("title", 1, instr("title", '（状態：') - 1))
WHERE instr("title", '（状態：') > 0
  AND substr(trim("title"), -1, 1) = '）';

UPDATE "Product"
SET
  "condition" = trim(substr(
    "title",
    instr("title", '(状態:') + 4,
    length("title") - (instr("title", '(状態:') + 4)
  )),
  "conditionRank" = 'B',
  "title" = trim(substr("title", 1, instr("title", '(状態:') - 1))
WHERE instr("title", '(状態:') > 0
  AND substr(trim("title"), -1, 1) = ')';

-- State-specific Surugaya URLs normally keep the same condition for their full
-- history, so existing histories can inherit the backfilled product condition.
UPDATE "PriceHistory"
SET
  "condition" = (
    SELECT "Product"."condition"
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
  ),
  "conditionRank" = COALESCE((
    SELECT "Product"."conditionRank"
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
  ), 'A')
WHERE EXISTS (
  SELECT 1
  FROM "Product"
  WHERE "Product"."id" = "PriceHistory"."productId"
    AND "Product"."conditionRank" = 'B'
);

CREATE INDEX "Product_conditionRank_idx" ON "Product"("conditionRank");
CREATE INDEX "PriceHistory_conditionRank_idx" ON "PriceHistory"("conditionRank");
