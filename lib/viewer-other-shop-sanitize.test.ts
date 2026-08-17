import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(
  new URL("../viewer/other-shop-embed.js", import.meta.url),
  "utf8",
);

test("Viewerは商品詳細表由来の旧他店舗誤解析を除外する", () => {
  assert.match(script, /VIEWER_PRODUCT_DETAIL_LABELS/u);
  assert.match(script, /viewerIsMisparsedOtherShopItem/u);
  assert.match(script, /detail\.junkHistories\.filter/u);
  assert.match(script, /snapshot\.items\.filter/u);
  assert.match(script, /メーカー/u);
  assert.match(script, /中古\|新品\|予約/u);
});

test("Viewer他店舗JavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
