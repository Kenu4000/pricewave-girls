import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260810051500_fix_updated_at_from_latest_history/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("更新順は最後に保存された履歴ではなく最新の価格取得時刻を使う", () => {
  assert.match(
    migration,
    /SELECT MAX\("PriceHistory"\."checkedAt"\)[\s\S]*WHERE "PriceHistory"\."productId" = NEW\."productId"/,
  );
  assert.doesNotMatch(
    migration,
    /SET "updatedAt" = NEW\."checkedAt"/,
  );
});
