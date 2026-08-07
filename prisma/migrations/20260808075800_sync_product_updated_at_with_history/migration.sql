-- 商品一覧の「更新が新しい順」は Product.updatedAt を参照している。
-- 価格取得経路に依存せず、PriceHistory が追加された日時を商品の最終更新日時として扱う。

-- 既存商品は、保存済み価格履歴の最新確認日時へ補正する。
UPDATE "Product"
SET "updatedAt" = COALESCE(
  (
    SELECT MAX("PriceHistory"."checkedAt")
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = "Product"."id"
  ),
  "Product"."updatedAt"
);

-- 個別更新・バッチ更新・自動更新のすべてで PriceHistory は追加されるため、
-- 履歴追加を唯一の基準にして Product.updatedAt を同期する。
DROP TRIGGER IF EXISTS "Product_touch_updated_at_from_price_history";
CREATE TRIGGER "Product_touch_updated_at_from_price_history"
AFTER INSERT ON "PriceHistory"
BEGIN
  UPDATE "Product"
  SET "updatedAt" = NEW."checkedAt"
  WHERE "id" = NEW."productId";
END;
