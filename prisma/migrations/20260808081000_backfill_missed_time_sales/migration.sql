-- 過去にタイムセール判定を取りこぼした履歴を補正する。
-- 現在タイムセール中で、通常価格とセール価格の両方が取得できている商品だけを対象にする。
-- 過去の販売価格が現在のタイムセール価格と同一なら、その履歴もタイムセールだったとみなす。
UPDATE "PriceHistory"
SET
  "isTimeSale" = 1,
  "regularSalePrice" = (
    SELECT "Product"."latestRegularSalePrice"
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
  )
WHERE "salePrice" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Product"
    WHERE "Product"."id" = "PriceHistory"."productId"
      AND "Product"."isTimeSale" = 1
      AND "Product"."latestSalePrice" IS NOT NULL
      AND "Product"."latestRegularSalePrice" IS NOT NULL
      AND "Product"."latestRegularSalePrice" <> "Product"."latestSalePrice"
      AND "PriceHistory"."salePrice" = "Product"."latestSalePrice"
  );
