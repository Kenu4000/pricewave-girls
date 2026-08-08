import assert from "node:assert/strict";
import test from "node:test";
import {
  addRecentlyViewedProductId,
  parseRecentlyViewedIds,
  RECENTLY_VIEWED_LIMIT,
} from "./recently-viewed";

test("再閲覧した商品を先頭へ移動して重複を作らない", () => {
  assert.deepEqual(addRecentlyViewedProductId([3, 2, 1], 2), [2, 3, 1]);
});

test("閲覧履歴は最新40件まで保持する", () => {
  const existing = Array.from({ length: RECENTLY_VIEWED_LIMIT }, (_, index) => index + 1);
  const next = addRecentlyViewedProductId(existing, 99);
  assert.equal(next.length, RECENTLY_VIEWED_LIMIT);
  assert.equal(next[0], 99);
  assert.equal(next.includes(RECENTLY_VIEWED_LIMIT), false);
});

test("壊れた保存値や不正IDを安全に除外する", () => {
  assert.deepEqual(parseRecentlyViewedIds("not-json"), []);
  assert.deepEqual(parseRecentlyViewedIds('[3,"2",2,0,-1,"x",1]'), [3, 2, 1]);
});
