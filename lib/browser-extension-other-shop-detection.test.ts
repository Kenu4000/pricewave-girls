import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const content = readFileSync(
  new URL("../browser-extension/content.js", import.meta.url),
  "utf8",
);

test("近くの店舗在庫表示でも他ショップ一覧を取得対象にする", () => {
  assert.match(content, /他のショップ\|近くの店舗に在庫\|全ての取扱店舗を見る/u);
  assert.match(content, /pricewaveReadOtherShops/u);
});

test("content scriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(content));
});
