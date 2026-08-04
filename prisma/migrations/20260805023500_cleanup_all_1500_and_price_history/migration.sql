-- The user confirmed that every alternate-condition 1,500 yen row should be removed,
-- including rows that were captured alone.
DELETE FROM "JunkHistory"
WHERE "sourceType" = 'alternate_condition'
  AND "storeName" IS NULL
  AND "price" = 1500;

-- Keep the newest ten snapshots for each product. Beyond that recent window,
-- retain only change points and delete rows identical to the immediately newer
-- snapshot. SQLite's IS operator treats NULL values as equal here.
WITH "rankedHistory" AS (
  SELECT
    "id",
    "salePrice",
    "buyPrice",
    "stockStatus",
    ROW_NUMBER() OVER (
      PARTITION BY "productId"
      ORDER BY "checkedAt" DESC, "id" DESC
    ) AS "rowNumber",
    LAG("salePrice") OVER (
      PARTITION BY "productId"
      ORDER BY "checkedAt" DESC, "id" DESC
    ) AS "newerSalePrice",
    LAG("buyPrice") OVER (
      PARTITION BY "productId"
      ORDER BY "checkedAt" DESC, "id" DESC
    ) AS "newerBuyPrice",
    LAG("stockStatus") OVER (
      PARTITION BY "productId"
      ORDER BY "checkedAt" DESC, "id" DESC
    ) AS "newerStockStatus"
  FROM "PriceHistory"
)
DELETE FROM "PriceHistory"
WHERE "id" IN (
  SELECT "id"
  FROM "rankedHistory"
  WHERE "rowNumber" > 10
    AND "salePrice" IS "newerSalePrice"
    AND "buyPrice" IS "newerBuyPrice"
    AND "stockStatus" IS "newerStockStatus"
);
