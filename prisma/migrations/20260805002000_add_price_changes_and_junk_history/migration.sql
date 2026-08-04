ALTER TABLE "Product" ADD COLUMN "salePriceChangedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "buyPriceChangedAt" DATETIME;

CREATE TABLE "JunkHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "condition" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JunkHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PriceChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "previousPrice" INTEGER,
    "currentPrice" INTEGER,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "JunkHistory_productId_checkedAt_idx" ON "JunkHistory"("productId", "checkedAt");
CREATE INDEX "PriceChange_changedAt_idx" ON "PriceChange"("changedAt");
CREATE INDEX "PriceChange_type_changedAt_idx" ON "PriceChange"("type", "changedAt");
CREATE INDEX "PriceChange_productId_changedAt_idx" ON "PriceChange"("productId", "changedAt");
CREATE INDEX "Product_salePriceChangedAt_idx" ON "Product"("salePriceChangedAt");
CREATE INDEX "Product_buyPriceChangedAt_idx" ON "Product"("buyPriceChangedAt");

WITH "orderedHistory" AS (
    SELECT
        "productId",
        "checkedAt",
        "salePrice",
        "buyPrice",
        ROW_NUMBER() OVER (
            PARTITION BY "productId"
            ORDER BY "checkedAt", "id"
        ) AS "sequence",
        LAG("salePrice") OVER (
            PARTITION BY "productId"
            ORDER BY "checkedAt", "id"
        ) AS "previousSalePrice",
        LAG("buyPrice") OVER (
            PARTITION BY "productId"
            ORDER BY "checkedAt", "id"
        ) AS "previousBuyPrice"
    FROM "PriceHistory"
),
"changes" AS (
    SELECT
        "productId",
        'sale' AS "type",
        "previousSalePrice" AS "previousPrice",
        "salePrice" AS "currentPrice",
        "checkedAt" AS "changedAt"
    FROM "orderedHistory"
    WHERE "sequence" > 1 AND "salePrice" IS NOT "previousSalePrice"

    UNION ALL

    SELECT
        "productId",
        'buy' AS "type",
        "previousBuyPrice" AS "previousPrice",
        "buyPrice" AS "currentPrice",
        "checkedAt" AS "changedAt"
    FROM "orderedHistory"
    WHERE "sequence" > 1 AND "buyPrice" IS NOT "previousBuyPrice"
)
INSERT INTO "PriceChange" (
    "productId",
    "type",
    "previousPrice",
    "currentPrice",
    "changedAt"
)
SELECT
    "productId",
    "type",
    "previousPrice",
    "currentPrice",
    "changedAt"
FROM "changes";

UPDATE "Product"
SET
    "salePriceChangedAt" = (
        SELECT MAX("PriceChange"."changedAt")
        FROM "PriceChange"
        WHERE
            "PriceChange"."productId" = "Product"."id"
            AND "PriceChange"."type" = 'sale'
    ),
    "buyPriceChangedAt" = (
        SELECT MAX("PriceChange"."changedAt")
        FROM "PriceChange"
        WHERE
            "PriceChange"."productId" = "Product"."id"
            AND "PriceChange"."type" = 'buy'
    )
WHERE "id" IN (SELECT DISTINCT "productId" FROM "PriceChange");
