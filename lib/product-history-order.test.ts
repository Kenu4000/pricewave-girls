import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sortProductIdsByLatestHistory } from "./product-history-order";
import { prependUniqueProduct } from "./product-preview";

test("商品一覧は最新のPriceHistory.checkedAtで新しい順・古い順に並ぶ", () => {
  const candidates = [
    { id: 1, histories: [{ checkedAt: new Date("2026-08-10T00:01:00Z") }] },
    { id: 2, histories: [{ checkedAt: new Date("2026-08-10T00:03:00Z") }] },
    { id: 3, histories: [{ checkedAt: new Date("2026-08-10T00:02:00Z") }] },
  ];

  assert.deepEqual(sortProductIdsByLatestHistory(candidates, "desc"), [2, 3, 1]);
  assert.deepEqual(sortProductIdsByLatestHistory(candidates, "asc"), [1, 3, 2]);
});

test("確認履歴が無い商品は確認日時ソートの末尾に置く", () => {
  const candidates = [
    { id: 1, histories: [] },
    { id: 2, histories: [{ checkedAt: new Date("2026-08-10T00:03:00Z") }] },
  ];

  assert.deepEqual(sortProductIdsByLatestHistory(candidates, "desc"), [2, 1]);
  assert.deepEqual(sortProductIdsByLatestHistory(candidates, "asc"), [2, 1]);
});

test("ライブ更新も保存完了順ではなく確認履歴時刻で並べ直す", () => {
  const current = [
    { id: 1, lastCheckedAt: "2026-08-10T00:03:00.000Z" },
    { id: 2, lastCheckedAt: "2026-08-10T00:01:00.000Z" },
  ];
  const lateSavedOlderCheck = {
    id: 3,
    lastCheckedAt: "2026-08-10T00:02:00.000Z",
  };

  assert.deepEqual(
    prependUniqueProduct(current, lateSavedOlderCheck, 24).map((product) => product.id),
    [1, 3, 2],
  );
});

test("updatedソートはProduct.updatedAtではなくPriceHistory.checkedAtを直接参照する", () => {
  const source = readFileSync(new URL("../app/products/page.tsx", import.meta.url), "utf8");
  assert.match(source, /histories:\s*\{[\s\S]*orderBy:\s*\{ checkedAt: "desc" \}/u);
  assert.match(source, /sortProductIdsByLatestHistory/u);
  assert.doesNotMatch(source, /"updated-desc":\s*\[\{ updatedAt:/u);
  assert.doesNotMatch(source, /"updated-asc":\s*\[\{ updatedAt:/u);
});
