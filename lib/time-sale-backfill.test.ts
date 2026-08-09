import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260810052500_backfill_legacy_missed_time_sales/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("過去の未判定履歴は後続の確定タイムセールを根拠に補正する", () => {
  assert.match(migration, /"confirmed"\."isTimeSale" = 1/);
  assert.match(migration, /"confirmed"\."salePrice" = "candidate"\."salePrice"/);
  assert.match(
    migration,
    /"confirmed"\."regularSalePrice" > "confirmed"\."salePrice"/,
  );
  assert.match(migration, /"confirmed"\."checkedAt" > "candidate"\."checkedAt"/);
});

test("既に別の通常価格情報を持つ履歴は推測で上書きしない", () => {
  assert.match(
    migration,
    /"candidate"\."regularSalePrice" IS NULL[\s\S]*OR "candidate"\."regularSalePrice" = "candidate"\."salePrice"/,
  );
});

test("補正済みタイムセール由来の売価変更を価格変更一覧から除外する", () => {
  assert.match(migration, /DELETE FROM "PriceChange"/);
  assert.match(migration, /"PriceHistory"\."regularSalePrice" = "PriceChange"\."previousPrice"/);
  assert.match(migration, /"PriceHistory"\."salePrice" = "PriceChange"\."currentPrice"/);
});
