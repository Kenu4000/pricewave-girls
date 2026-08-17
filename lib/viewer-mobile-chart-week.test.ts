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

test("Viewerの価格推移はmainと同じ日・週・月モードを使う", () => {
  assert.match(script, /let viewerChartMode = 'day'/u);
  assert.match(script, /value: 'day', label: '日（全期間）'/u);
  assert.match(script, /value: 'week', label: '週'/u);
  assert.match(script, /value: 'month', label: '月'/u);
  assert.doesNotMatch(script, />7日<\/button>/u);
  assert.doesNotMatch(script, />1か月<\/button>/u);
});

test("商品を切り替えると日モードへ戻る", () => {
  assert.match(script, /viewerChartSourceHistories !== histories\) viewerChartMode = 'day'/u);
});

test("日モードは全取得点を保持し同日複数点だけ時刻付きラベルにする", () => {
  assert.match(script, /if \(mode === 'day'\)/u);
  assert.match(script, /pointsPerDay/u);
  assert.match(script, /return valid\.map\(\(history, index\)/u);
  assert.match(script, /viewerChartDayLabel\(history\.date, \(pointsPerDay\.get\(key\) \?\? 0\) > 1\)/u);
});

test("週・月モードは各バケットの最終取得値を使う", () => {
  assert.match(script, /buckets\.set\(viewerChartBucketKey\(history\.date, mode\), history\)/u);
  assert.match(script, /viewerChartStartOfWeek/u);
  assert.match(script, /viewerChartBucketLabel/u);
});

test("タイムセールとランクBの系列を分離する", () => {
  assert.match(script, /const conditionRank = history\.conditionRank === 'B' \|\| history\.condition \? 'B' : 'A'/u);
  assert.match(script, /history\.regularSalePrice \?\? history\.salePrice/u);
  assert.match(script, /salePrice: conditionRank === 'B' \? null : baseSalePrice/u);
  assert.match(script, /rankBPrice: conditionRank === 'B' \? baseSalePrice : null/u);
  assert.match(script, /timeSalePrice: isTimeSale \? history\.salePrice : null/u);
  assert.match(script, /timeSaleBasePrice: isTimeSale \? baseSalePrice : null/u);
});

test("販売・買取・ランクBは欠損を接続しタイムセールは接続しない", () => {
  assert.match(script, /key: 'salePrice'[\s\S]*?connectNulls: true/u);
  assert.match(script, /key: 'buyPrice'[\s\S]*?connectNulls: true/u);
  assert.match(script, /key: 'rankBPrice'[\s\S]*?connectNulls: true/u);
  assert.match(script, /key: 'timeSalePrice'[\s\S]*?connectNulls: false/u);
});

test("タイムセールは通常価格から黄色破線で分岐表示する", () => {
  assert.match(script, /viewer-chart-timesale-branch/u);
  assert.match(script, /point\.timeSalePrice !== point\.timeSaleBasePrice/u);
  assert.match(css, /\.viewer-chart-timesale-branch\s*\{[\s\S]*?stroke:\s*#eab308/u);
  assert.match(css, /\.viewer-chart-timesale-branch\s*\{[\s\S]*?stroke-dasharray:\s*4 3/u);
});

test("ツールチップ追従と縦クロスヘアを表示する", () => {
  assert.match(script, /class="viewer-chart-crosshair"/u);
  assert.match(script, /class="viewer-chart-tooltip" hidden/u);
  assert.match(script, /addEventListener\('pointerenter', selectFromPointer\)/u);
  assert.match(script, /addEventListener\('pointermove', selectFromPointer\)/u);
  assert.match(script, /addEventListener\('pointerdown', selectFromPointer\)/u);
  assert.match(script, /nearestIndex/u);
});

test("ツールチップは絶対配置のままポインターへ追従しグラフのレイアウトを動かさない", () => {
  assert.match(css, /\.viewer-chart-wrap\s*\{[\s\S]*?position:\s*relative/u);
  assert.match(css, /\.viewer-chart-tooltip\s*\{[\s\S]*?position:\s*absolute/u);
  assert.match(css, /\.viewer-chart-tooltip\s*\{[\s\S]*?left:\s*0/u);
  assert.match(css, /\.viewer-chart-tooltip\s*\{[\s\S]*?top:\s*0/u);
  assert.match(script, /const positionTooltip = \(event\) =>/u);
  assert.match(script, /tooltip\.style\.left = `\$\{left\}px`/u);
  assert.match(script, /tooltip\.style\.top = `\$\{top\}px`/u);
  assert.doesNotMatch(css, /\.viewer-chart-tooltip\s*\{[\s\S]*?margin:/u);
});

test("モバイルは横スクロールせず縦スクロールを維持する", () => {
  assert.match(css, /overflow:\s*hidden/u);
  assert.match(css, /overscroll-behavior-x:\s*none/u);
  assert.match(css, /touch-action:\s*pan-y/u);
});

test("ViewerグラフJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
