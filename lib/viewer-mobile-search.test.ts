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

test("メーカー候補は上位12件と全メーカー五十音順を分けて表示する", () => {
  assert.match(script, /label="よく登録されているメーカー"/u);
  assert.match(script, /label="五十音順"/u);
  assert.match(script, /<option value="" \$\{state\.brand \? '' : 'selected'\}>すべて<\/option>/u);
  assert.match(script, /\.slice\(0, 12\)/u);
  assert.match(script, /const alphabetical = \[\.\.\.counts\.keys\(\)\]/u);
  assert.doesNotMatch(
    script,
    /const alphabetical\s*=\s*[^;]*\.filter\([^)]*featured/gu,
  );
});