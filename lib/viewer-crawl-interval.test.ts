import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const exporterSource = readFileSync(
  new URL("../scripts/export-viewer-data.ts", import.meta.url),
  "utf8",
);
const htmlSource = readFileSync(
  new URL("../viewer/index.html", import.meta.url),
  "utf8",
);
const displaySource = readFileSync(
  new URL("../viewer/crawl-interval-display.js", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../viewer/crawl-interval-display.css", import.meta.url),
  "utf8",
);

test("Viewer公開データへ商品ごとの巡回周期を書き出す", () => {
  const matches = exporterSource.match(/crawlIntervalDays:\s*product\.crawlIntervalDays/gu) ?? [];
  assert.equal(matches.length, 2);
});

test("Viewerは一覧と商品詳細に巡回周期を表示する", () => {
  assert.doesNotThrow(() => new vm.Script(displaySource));
  assert.match(displaySource, /巡回: /u);
  assert.match(displaySource, /巡回周期 /u);
  assert.match(displaySource, /a\.product-card/u);
  assert.match(displaySource, /\.detail-prices/u);
  assert.match(displaySource, /value === null/u);
  assert.match(displaySource, /label: '14日'/u);
});

test("Viewerの巡回周期色はmainの商品一覧と同じ5色を使う", () => {
  assert.match(cssSource, /#16835f/u);
  assert.match(cssSource, /#2878bd/u);
  assert.match(cssSource, /#7558b5/u);
  assert.match(cssSource, /#a46124/u);
  assert.match(cssSource, /#62676d/u);
});

test("Viewer HTMLがキャッシュキー付きで巡回周期のCSSとJavaScriptを読み込む", () => {
  assert.match(htmlSource, /href="\.\/crawl-interval-display\.css\?v=[^"]+"/u);
  assert.match(htmlSource, /src="\.\/crawl-interval-display\.js\?v=[^"]+"/u);
});
