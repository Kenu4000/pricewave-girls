import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function text(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Viewerホームは商品検索パネルの下に価格変更を表示する", async () => {
  const source = await text("viewer/home-ui.js");
  assert.doesNotThrow(() => new vm.Script(source));
  assert.match(source, /renderChangePage\(\)/u);
  assert.match(source, /renderProductSearchPage\(null, '商品検索'\)/u);
  assert.match(source, /#viewer-product-search/u);
  assert.match(source, /searchSection\.append\(heading, searchForm\)/u);
  assert.match(source, /app\.replaceChildren\(searchSection, changeFragment\)/u);
});

test("商品検索を実行した時だけ従来の商品カード検索結果へ切り替える", async () => {
  const source = await text("viewer/home-ui.js");
  assert.match(source, /location\.hash\.startsWith\('#\/products\?'\)/u);
  assert.match(source, /history\.replaceState\(null, '', '#\/products\?search=1'\)/u);
  assert.match(source, /renderProductSearchPage\(null, '検索結果'\)/u);
  assert.match(source, /if \(customProducts\) return renderProductSearchPage\(customProducts, title\)/u);
});

test("Viewerの通常入口は価格変更ホームで商品一覧ナビを持たない", async () => {
  const source = await text("viewer/home-ui.js");
  const html = await text("viewer/index.html");
  assert.match(source, /history\.replaceState\(null, '', '#\/changes'\)/u);
  assert.match(html, /<a class="brand" href="#\/changes">/u);
  assert.match(html, /<a href="#\/changes">価格変更<\/a>/u);
  assert.match(html, /<a href="#\/history">履歴<\/a>/u);
  assert.doesNotMatch(html, /<a href="#\/products">商品一覧<\/a>/u);
});

test("ホーム補正はLeaf正規化の後に最後に読み込む", async () => {
  const html = await text("viewer/index.html");
  const leaf = html.indexOf("leaf-brand-normalization.js");
  const home = html.indexOf("home-ui.js");
  assert.ok(leaf >= 0);
  assert.ok(home > leaf);
  assert.equal(html.slice(home).match(/<script\s+src=/gu)?.length ?? 0, 1);
});
