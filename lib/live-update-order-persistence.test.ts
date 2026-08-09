import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productGrid = readFileSync(
  new URL("../components/ProductGrid.tsx", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260810062000_enforce_update_order_from_price_history/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("ライブ更新後は遅れて届いたRendering結果で商品順を初期化しない", () => {
  assert.match(productGrid, /const liveOrderLockedRef = useRef\(false\)/u);
  assert.match(productGrid, /if \(liveOrderLockedRef\.current\) return;/u);
  assert.match(productGrid, /liveOrderLockedRef\.current = true;[\s\S]*prependUniqueProduct/u);
});

test("DBの更新順は常に最新PriceHistory.checkedAtへ固定する", () => {
  assert.match(
    migration,
    /SELECT MAX\("PriceHistory"\."checkedAt"\)[\s\S]*WHERE "PriceHistory"\."productId" = NEW\."productId"/u,
  );
  assert.match(migration, /CREATE TRIGGER "Product_guard_updated_at_from_price_history"/u);
  assert.match(migration, /AFTER UPDATE OF "updatedAt" ON "Product"/u);
});
