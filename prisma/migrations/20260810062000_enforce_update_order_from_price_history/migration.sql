-- 「更新が新しい順」は価格取得履歴だけを基準にする。
-- Product.updatedAt が別処理で書き換わっても、最新 PriceHistory.checkedAt へ戻す。

-- 既存データも最新の価格取得時刻へ再補正する。
UPDATE "Product"
SET "updatedAt" = COALESCE(
  (
    SELECT MAX("PriceHistory"."checkedAt")
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = "Product"."id"
  ),
  "Product"."updatedAt"
);

-- 履歴が追加されたら、保存完了順ではなく checkedAt の最大値を採用する。
DROP TRIGGER IF EXISTS "Product_touch_updated_at_from_price_history";
CREATE TRIGGER "Product_touch_updated_at_from_price_history"
AFTER INSERT ON "PriceHistory"
BEGIN
  UPDATE "Product"
  SET "updatedAt" = COALESCE(
    (
      SELECT MAX("PriceHistory"."checkedAt")
      FROM "PriceHistory"
      WHERE "PriceHistory"."productId" = NEW."productId"
    ),
    NEW."checkedAt"
  )
  WHERE "id" = NEW."productId";
END;

-- Product.updatedAt を直接変更する処理が後から走っても、価格履歴がある商品は
-- 必ず最新 checkedAt に戻す。古い Rendering が完了した後もDB上の更新順は崩れない。
DROP TRIGGER IF EXISTS "Product_guard_updated_at_from_price_history";
CREATE TRIGGER "Product_guard_updated_at_from_price_history"
AFTER UPDATE OF "updatedAt" ON "Product"
WHEN EXISTS (
  SELECT 1
  FROM "PriceHistory"
  WHERE "PriceHistory"."productId" = NEW."id"
)
AND NEW."updatedAt" IS NOT (
  SELECT MAX("PriceHistory"."checkedAt")
  FROM "PriceHistory"
  WHERE "PriceHistory"."productId" = NEW."id"
)
BEGIN
  UPDATE "Product"
  SET "updatedAt" = (
    SELECT MAX("PriceHistory"."checkedAt")
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = NEW."id"
  )
  WHERE "id" = NEW."id";
END;
