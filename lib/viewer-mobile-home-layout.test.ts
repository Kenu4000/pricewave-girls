import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerはモバイルでも価格変更をホームにして商品一覧ナビを出さない", async () => {
  const index = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");
  const home = await readFile(new URL("../viewer/home-ui.js", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../viewer/mobile-home-layout.css", import.meta.url), "utf8");

  assert.match(index, /href="#\/changes">価格変更<\/a>/u);
  assert.doesNotMatch(index, />商品一覧<\/a>/u);
  assert.match(index, /home-ui\.js/u);
  assert.match(index, /mobile-home-layout\.css/u);
  assert.match(home, /renderChangePage\(\)/u);
  assert.match(home, /renderProductSearchPage\(null, '商品検索'\)/u);
  assert.match(home, /#\/products\?search=1/u);
  assert.match(mobile, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
});
