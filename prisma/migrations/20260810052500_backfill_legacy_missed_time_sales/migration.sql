-- タイムセール判定を取得できていなかった時期の履歴を、後から得られた確定情報で保守的に補正する。
--
-- 1) 現在タイムセール中で通常価格とセール価格の両方が確定している商品について、
--    過去の同一セール価格を再補正する（従来の補正条件を再実行）。
-- 2) 現在はタイムセールでなくても、後の PriceHistory に同一商品・同一セール価格の
--    「isTimeSale=1 かつ 通常価格>セール価格」が存在する場合、その確定履歴より前にある
--    未判定の同価格履歴をタイムセールだった可能性が高いものとして補正する。
--
-- regularSalePrice が既に salePrice と異なる履歴は、別の明示情報を持っているため変更しない。

UPDATE "PriceHistory"
SET
  "isTimeSale" = 1,
  "regularSalePrice" = (
    SELECT "Product"."latestRegularSalePrice"
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
  )
WHERE "isTimeSale" = 0
  AND "salePrice" IS NOT NULL
  AND ("regularSalePrice" IS NULL OR "regularSalePrice" = "salePrice")
  AND EXISTS (
    SELECT 1
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
      AND "Product"."isTimeSale" = 1
      AND "Product"."latestSalePrice" IS NOT NULL
      AND "Product"."latestRegularSalePrice" IS NOT NULL
      AND "Product"."latestRegularSalePrice" > "Product"."latestSalePrice"
      AND "PriceHistory"."salePrice" = "Product"."latestSalePrice"
  );

UPDATE "PriceHistory" AS "candidate"
SET
  "isTimeSale" = 1,
  "regularSalePrice" = (
    SELECT "confirmed"."regularSalePrice"
    FROM "PriceHistory" AS "confirmed"
    WHERE "confirmed"."productId" = "candidate"."productId"
      AND "confirmed"."isTimeSale" = 1
      AND "confirmed"."salePrice" = "candidate"."salePrice"
      AND "confirmed"."regularSalePrice" IS NOT NULL
      AND "confirmed"."regularSalePrice" > "confirmed"."salePrice"
      AND "confirmed"."checkedAt" > "candidate"."checkedAt"
    ORDER BY "confirmed"."checkedAt" ASC, "confirmed"."id" ASC
    LIMIT 1
  )
WHERE "candidate"."isTimeSale" = 0
  AND "candidate"."salePrice" IS NOT NULL
  AND (
    "candidate"."regularSalePrice" IS NULL
    OR "candidate"."regularSalePrice" = "candidate"."salePrice"
  )
  AND EXISTS (
    SELECT 1
    FROM "PriceHistory" AS "confirmed"
    WHERE "confirmed"."productId" = "candidate"."productId"
      AND "confirmed"."isTimeSale" = 1
      AND "confirmed"."salePrice" = "candidate"."salePrice"
      AND "confirmed"."regularSalePrice" IS NOT NULL
      AND "confirmed"."regularSalePrice" > "confirmed"."salePrice"
      AND "confirmed"."checkedAt" > "candidate"."checkedAt"
  );

-- 補正対象になった「通常価格→タイムセール価格」の売価変更イベントも、
-- 価格変更一覧へ残さない。履歴取得時刻と10分以内で一致する同一価格ペアだけ削除する。
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
