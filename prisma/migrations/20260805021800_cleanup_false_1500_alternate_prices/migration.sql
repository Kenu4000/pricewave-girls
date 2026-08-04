-- The old parser could attach the footer text
-- "1,500円以上お買上げで送料無料" to the final alternate-condition item.
-- Delete only rows matching that characteristic:
--   * alternate-condition entry without a store
--   * price is exactly 1,500 yen
--   * final inserted alternate-condition row in the same product/capture second
--   * at least one sibling alternate-condition row exists in that capture
-- This avoids deleting standalone 1,500-yen entries, which may be legitimate.
DELETE FROM "JunkHistory"
WHERE "id" IN (
  SELECT candidate."id"
  FROM "JunkHistory" AS candidate
  WHERE candidate."sourceType" = 'alternate_condition'
    AND candidate."storeName" IS NULL
    AND candidate."price" = 1500
    AND candidate."id" = (
      SELECT MAX(peer."id")
      FROM "JunkHistory" AS peer
      WHERE peer."productId" = candidate."productId"
        AND peer."sourceType" = 'alternate_condition'
        AND peer."storeName" IS NULL
        AND strftime('%Y-%m-%d %H:%M:%S', peer."checkedAt") =
            strftime('%Y-%m-%d %H:%M:%S', candidate."checkedAt")
    )
    AND EXISTS (
      SELECT 1
      FROM "JunkHistory" AS sibling
      WHERE sibling."productId" = candidate."productId"
        AND sibling."sourceType" = 'alternate_condition'
        AND sibling."storeName" IS NULL
        AND sibling."id" <> candidate."id"
        AND strftime('%Y-%m-%d %H:%M:%S', sibling."checkedAt") =
            strftime('%Y-%m-%d %H:%M:%S', candidate."checkedAt")
    )
);
