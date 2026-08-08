-- Product.updatedAt は商品一覧の「更新順」専用として扱う。
-- @updatedAt による商品情報更新時の自動変更を止め、価格履歴の checkedAt のみ同期する。

-- 既存データは、保存済み価格履歴の最新確認日時へ再補正する。
UPDATE "Product"
SET "updatedAt" = COALESCE(
  (
    SELECT MAX("PriceHistory"."checkedAt")
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = "Product"."id"
  ),
  "Product"."updatedAt"
);

-- 価格履歴追加時だけ Product.updatedAt を動かす。
DROP TRIGGER IF EXISTS "Product_touch_updated_at_from_price_history";
CREATE TRIGGER "Product_touch_updated_at_from_price_history"
AFTER INSERT ON "PriceHistory"
BEGIN
  UPDATE "Product"
  SET "updatedAt" = NEW."checkedAt"
  WHERE "id" = NEW."productId";
END;
