-- 商品一覧の「更新が新しい順」は、DBへ書き込まれた順ではなく
-- 実際の価格取得時刻（PriceHistory.checkedAt）の最新値を基準にする。
-- 並列取得では古いcheckedAtを持つリクエストが後から保存されることがあるため、
-- NEW.checkedAtをそのままProduct.updatedAtへ代入すると更新順が逆行し得る。

-- 既存データを各商品の最新価格取得時刻へ補正する。
UPDATE "Product"
SET "updatedAt" = COALESCE(
  (
    SELECT MAX("PriceHistory"."checkedAt")
    FROM "PriceHistory"
    WHERE "PriceHistory"."productId" = "Product"."id"
  ),
  "Product"."updatedAt"
);

-- PriceHistory追加後は、その商品の履歴全体のMAX(checkedAt)を採用する。
-- これにより保存完了順が前後してもupdatedAtが過去へ戻らない。
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
