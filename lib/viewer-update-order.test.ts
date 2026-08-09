import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportSource = readFileSync(
  new URL("../scripts/export-viewer-data.ts", import.meta.url),
  "utf8",
);
const publishSource = readFileSync(
  new URL("../scripts/publish-viewer.mjs", import.meta.url),
  "utf8",
);

test("GitHub Pagesの商品更新順は最新PriceHistory.checkedAtを直接使う", () => {
  assert.match(exportSource, /function latestCheckedAt/);
  assert.match(exportSource, /product\.histories\.at\(-1\)\?\.checkedAt/);
  assert.match(exportSource, /products\.sort/);
  assert.match(exportSource, /updatedAt: latestCheckedAt\(product\)/);
});

test("viewer publishは未適用migrationを先に反映する", () => {
  const migrateIndex = publishSource.indexOf('runNpm(["exec", "prisma", "migrate", "deploy"])');
  const exportIndex = publishSource.indexOf('runNpm(["run", "viewer:export"])');
  assert.ok(migrateIndex >= 0);
  assert.ok(exportIndex > migrateIndex);
});
