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

test("モバイルグラフはデータのある直近7日をデフォルト表示にする", () => {
  assert.match(script, /let mobileChartRange = 'week'/u);
  assert.match(script, /mobileChartDailyHistories\(histories\)/u);
  assert.match(script, /latestByDay\.set\(key, history\)/u);
  assert.match(script, /dailyData\.slice\(-7\)/u);
  assert.match(script, />7日<\/button>/u);
});

test("同じ日の複数確認はその日の最後の1件だけを使う", () => {
  assert.match(script, /sort\(\(left, right\) => new Date\(left\.checkedAt\) - new Date\(right\.checkedAt\)\)/u);
  assert.match(script, /localDayKey\(history\.checkedAt\)/u);
  assert.match(script, /latestByDay\.set\(key, history\)/u);
});

test("縦軸は0円固定ではなく表示データに合わせて余白を取る", () => {
  assert.match(script, /const minV = Math\.min\(\.\.\.values\)/u);
  assert.match(script, /const spread = Math\.max\(1, maxV - minV\)/u);
  assert.match(script, /const pad = Math\.max\(120, spread \* 0\.16\)/u);
  assert.match(script, /const lo = Math\.max\(0, minV - pad\)/u);
  assert.doesNotMatch(script, /const lo = 0/u);
});

test("価格線の下を同色の半透明面で塗る", () => {
  assert.match(script, /class="chart-area"/u);
  assert.match(script, /class="chart-area-hit"/u);
  assert.match(script, /areaPathForSegment/u);
  assert.match(css, /\.chart-area\s*\{[\s\S]*?fill:\s*currentColor[\s\S]*?fill-opacity:\s*\.11/u);
});

test("面・線・点の広い判定から系列を選択できる", () => {
  assert.match(script, /data-chart-series-hit/u);
  assert.match(script, /data-series="\$\{key\}"/u);
  assert.match(script, /addEventListener\('pointerdown'/u);
  assert.match(script, /addEventListener\('pointermove'/u);
  assert.match(css, /\.chart-line-hit\s*\{[\s\S]*?stroke-width:\s*30/u);
  assert.match(css, /\.chart-point-hit\s*\{/u);
});

test("選択位置に垂直ガイドと系列色の点を表示する", () => {
  assert.match(script, /class="chart-crosshair"/u);
  assert.match(script, /class="chart-active-point"/u);
  assert.match(script, /nearestPoint\(series, eventToSvgX\(event\)\)/u);
  assert.match(script, /readout\.textContent/u);
  assert.match(css, /\.chart-crosshair\s*\{/u);
  assert.match(css, /\.chart-active-point\.sale/u);
  assert.match(css, /\.chart-active-point\.buy/u);
  assert.match(css, /\.chart-active-point\.rankb/u);
});

test("7日表示はデータがある7点を均等配置し各日の日付を表示する", () => {
  assert.match(script, /mobileChartRange === 'week' \? xByIndex\(index\) : xByTime\(point\.t\)/u);
  assert.match(script, /xLabels = data\.map\(\(point, index\)/u);
  assert.match(script, /mobileChartDateLabel\(point\.t, includeYear\)/u);
});

test("7日・1か月・全期間を切り替えられる", () => {
  assert.match(script, /data-mobile-chart-range="week"/u);
  assert.match(script, /data-mobile-chart-range="month"/u);
  assert.match(script, /data-mobile-chart-range="all"/u);
});

test("モバイルグラフは横スワイプせず縦スクロールを維持する", () => {
  assert.match(css, /overflow:\s*hidden/u);
  assert.match(css, /overscroll-behavior-x:\s*none/u);
  assert.match(css, /touch-action:\s*pan-y/u);
});

test("モバイルグラフJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
