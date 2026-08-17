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

test("商品を切り替えるとmainと同じく日モードへ戻る", () => {
  assert.match(script, /viewerChartSourceHistories !== histories\) viewerChartMode = 'day'/u);
});

test("日モードはmainと同じく全取得点を保持し同日複数点だけ時刻付きラベルにする", () => {
  assert.match(script, /if \(mode === 'day'\)/u);
  assert.match(script, /pointsPerDay/u);
  assert.match(script, /return valid\.map\(\(history, index\)/u);
  assert.match(script, /viewerChartDayLabel\(history\.date, \(pointsPerDay\.get\(key\) \?\? 0\) > 1\)/u);
});

test("週・月モードはmainと同じく各バケットの最終取得値を使う", () => {
  assert.match(script, /buckets\.set\(viewerChartBucketKey\(history\.date, mode\), history\)/u);
  assert.match(script, /viewerChartStartOfWeek/u);
  assert.match(script, /viewerChartBucketLabel/u);
});

test("タイムセールとランクBの系列分離はmainのprice-chart-dataと同じ", () => {
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

test("mainと同じ系列色と凡例名を使う", () => {
  assert.match(script, /label: '販売価格'/u);
  assert.match(script, /label: '買取価格'/u);
  assert.match(script, /label: 'ランクB'/u);
  assert.match(script, /label: 'タイムセール'/u);
  assert.match(css, /\.viewer-chart-series\.sale\s*\{[\s\S]*?color:\s*#d9469a/u);
  assert.match(css, /\.viewer-chart-series\.buy\s*\{[\s\S]*?color:\s*#3b82f6/u);
  assert.match(css, /\.viewer-chart-series\.rankb\s*\{[\s\S]*?color:\s*#16a34a/u);
  assert.match(css, /\.viewer-chart-series\.timesale\s*\{[\s\S]*?color:\s*#eab308/u);
});

test("mainと同じ説明文とレスポンシブ高さを使う", () => {
  assert.match(script, /全期間を取得時刻ごとに表示。黄色は通常価格から一時的に分岐したタイムセール価格/u);
  assert.match(script, /全期間を週ごとの最終価格で表示/u);
  assert.match(script, /全期間を月ごとの最終価格で表示/u);
  assert.match(css, /\.viewer-chart-wrap\s*\{[\s\S]*?height:\s*245px/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.viewer-chart-wrap\s*\{[\s\S]*?height:\s*220px/u);
});

test("モバイルは横スクロールせず縦スクロールを維持する", () => {
  assert.match(css, /overflow:\s*hidden/u);
  assert.match(css, /overscroll-behavior-x:\s*none/u);
  assert.match(css, /touch-action:\s*pan-y/u);
});

test("ViewerグラフJavaScriptを構文解析できる", () => {
  assert.doesNotThrow(() => new Function(script));
});
