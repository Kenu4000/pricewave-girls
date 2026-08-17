import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(
  new URL("../viewer/mobile-search.js", import.meta.url),
  "utf8",
);
const html = readFileSync(
  new URL("../viewer/index.html", import.meta.url),
  "utf8",
);

test("viewerのモバイル検索補助スクリプトを構文解析できる", () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test("商品名入力では検索欄全体を再描画せず結果領域だけ更新する", () => {
  assert.match(
    script,
    /querySelector\('#q'\)\.addEventListener\('input',[\s\S]*?state\.query\s*=\s*event\.target\.value;[\s\S]*?renderStandardResults\(\);/u,
  );
  assert.doesNotMatch(
    script,
    /querySelector\('#q'\)\.addEventListener\('input',[\s\S]*?renderProducts(?:StableSearch)?\(\);/u,
  );
  assert.match(script, /id="viewer-product-results"/u);
});

test("検索修正はapp.jsの後に読み込んでrenderProductsを差し替える", () => {
  const appIndex = html.indexOf('<script src="./app.js"></script>');
  const fixIndex = html.indexOf('<script src="./mobile-search.js"></script>');
  assert.ok(appIndex >= 0);
  assert.ok(fixIndex > appIndex);
  assert.match(script, /globalThis\.renderProducts\s*=\s*renderProductsStableSearch/u);
});

test("メーカー候補は3日以内率を最優先して件数制限せず並べる", () => {
  assert.match(script, /label="よく登録されているメーカー"/u);
  assert.match(script, /label="五十音順"/u);
  assert.match(script, /product\.crawlIntervalDays === 1/u);
  assert.match(script, /product\.crawlIntervalDays === 3/u);
  assert.match(script, /product\.crawlIntervalDays === 7/u);
  assert.match(script, /product\.crawlIntervalDays === 14/u);
  assert.match(
    script,
    /compareRatioDescending\(left\.withinThreeDays,[\s\S]*?compareRatioDescending\(left\.daily,[\s\S]*?compareRatioDescending\(left\.withinSevenDays,[\s\S]*?compareRatioDescending\(left\.active,/u,
  );
  assert.match(script, /\|\| right\.total - left\.total/u);
  assert.doesNotMatch(script, /\.slice\(0, 12\)/u);
});

test("五十音順には注目メーカーも含む全メーカーを残す", () => {
  assert.match(script, /const alphabetical = \[\.\.\.profiles\.keys\(\)\]/u);
  assert.doesNotMatch(
    script,
    /const alphabetical\s*=\s*[^;]*\.filter\([^)]*featured/gu,
  );
});

test("注目度ソートは価格変動率・変更回数・反転回数・直近性を評価する", () => {
  assert.match(script, /value="interesting_desc"[^>]*>注目度が高い順/u);
  assert.match(script, /Math\.min\(rangeRatio, 2\) \* 40/u);
  assert.match(script, /Math\.min\(changeCount, 12\) \* 3/u);
  assert.match(script, /Math\.min\(reversalCount, 6\) \* 8/u);
  assert.match(script, /Math\.max\(0, 1 - ageDays \/ 30\) \* 20/u);
  assert.match(script, /globalThis\.filteredProducts\s*=\s*function filteredProductsWithInterest/u);
  assert.match(script, /state\.sort !== 'interesting_desc'/u);
});
