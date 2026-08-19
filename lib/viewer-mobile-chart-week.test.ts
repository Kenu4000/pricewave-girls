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

test("Viewerはモバイルを含め全価格系列の取得点を表示する", () => {
  assert.match(script, /class="viewer-chart-dot"/u);
  assert.match(script, /series\.key === 'timeSalePrice' \? \(compact \? 3 : 4\) : \(compact \? 2\.5 : 3\)/u);
  assert.doesNotMatch(script, /const showDot = !compact/u);
  assert.match(css, /\.viewer-chart-dot\s*\{[\s\S]*?stroke:\s*#fff/u);
});

test("触れている取得点の価格をグラフ上部の固定欄へ表示する", () => {
  assert.match(script, /function viewerChartReadout\(point\)/u);
  assert.match(script, /class="viewer-chart-readout"/u);
  assert.match(script, /viewerChartReadout\(initialPoint\)/u);
  assert.match(script, /const updateReadout = \(point\) =>/u);
  assert.match(script, /value\.textContent = viewerChartYen\(point\[series\.key\]\)/u);
  assert.match(css, /\.viewer-chart-readout\s*\{[\s\S]*?min-height:\s*54px/u);
});

test("PCは追従ツールチップを残しモバイルは固定価格欄だけ使う", () => {
  assert.match(script, /class="viewer-chart-tooltip" hidden/u);
  assert.match(script, /if \(compact\) \{\s*tooltip\.hidden = true;\s*return;/su);
  assert.match(script, /if \(compact\) return;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.viewer-chart-tooltip\s*\{\s*display:\s*none !important;/su);
});

test("ポインター位置から固定価格欄と縦クロスヘアを更新する", () => {
  assert.match(script, /class="viewer-chart-crosshair"/u);
  assert.match(script, /addEventListener\('pointerenter', selectFromPointer\)/u);
  assert.match(script, /addEventListener\('pointermove', selectFromPointer\)/u);
  assert.match(script, /addEventListener\('pointerdown', selectFromPointer\)/u);
  assert.match(script, /nearestIndex/u);
  assert.match(script, /updateReadout\(point\)/u);
});

test("PCツールチップは絶対配置でグラフのレイアウトを動かさない", () => {
  assert.match(css, /\.viewer-chart-wrap\s*\{[\s\S]*?position:\s*relative/u);
  assert.match(css, /\.viewer-chart-tooltip\s*\{[\s\S]*?position:\s*absolute/u);
  assert.match(script, /const positionTooltip = \(event\) =>/u);
  assert.match(script, /tooltip\.style\.left = `\$\{left\}px`/u);
  assert.match(script, /tooltip\.style\.top = `\$\{top\}px`/u);
});

test("モバイルは横スクロールせず縦スクロールを維持する", () => {
  assert.match(css, /overflow:\s*hidden/u);
  assert.match(css, /overscroll-behavior-x:\s*none/u);
  assert.match(css, /touch-action:\s*pan-y/u);
});

test("ViewerグラフJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
