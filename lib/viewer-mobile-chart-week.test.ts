import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(
  new URL("../viewer/mobile-chart.js", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../viewer/mobile-chart.css", import.meta.url),
  "utf8",
);

test("モバイルグラフは1週間をデフォルト表示にする", () => {
  assert.match(script, /let mobileChartRange = 'week'/u);
  assert.match(script, /date\.getDate\(\) - 6/u);
  assert.match(script, /Array\.from\(\{ length: 7 \}/u);
});

test("1週間・1か月・全期間を切り替えられる", () => {
  assert.match(script, /data-mobile-chart-range="week"/u);
  assert.match(script, /data-mobile-chart-range="month"/u);
  assert.match(script, /data-mobile-chart-range="all"/u);
});

test("価格点は見た目とは別に大きいタップ判定を持つ", () => {
  assert.match(script, /class="chart-point"/u);
  assert.match(script, /class="chart-hit"[^>]*r="36"/u);
  assert.match(script, /querySelectorAll\('\.chart-hit'\)/u);
  assert.match(script, /addEventListener\('click'/u);
});

test("モバイルグラフは横スワイプせず縦スクロールを維持する", () => {
  assert.match(css, /overflow:\s*hidden/u);
  assert.match(css, /overscroll-behavior-x:\s*none/u);
  assert.match(css, /touch-action:\s*pan-y/u);
});

test("モバイルグラフJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
