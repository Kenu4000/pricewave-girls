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

test("縦軸は0円始まりで1000円以上をk表記にする", () => {
  assert.match(script, /Math\.abs\(rounded\) >= 1000/u);
  assert.match(script, /rounded \/ 1000/u);
  assert.match(script, /const lo = 0/u);
  assert.match(script, /Math\.round\(hi - ratio \* hi\)/u);
});

test("7日・1か月・全期間を切り替えられる", () => {
  assert.match(script, /data-mobile-chart-range="week"/u);
  assert.match(script, /data-mobile-chart-range="month"/u);
  assert.match(script, /data-mobile-chart-range="all"/u);
});

test("7日表示はデータがある7点を均等配置し各日の日付を表示する", () => {
  assert.match(script, /mobileChartRange === 'week' \? xByIndex\(index\) : xByTime\(point\.t\)/u);
  assert.match(script, /xLabels = data\.map\(\(point, index\)/u);
  assert.match(script, /mobileChartDateLabel\(point\.t, includeYear\)/u);
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
