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
