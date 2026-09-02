import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Viewerヘッダーは商品一覧・価格変更・履歴だけを表示する", async () => {
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(html, /<a href="#\/products">商品一覧<\/a>/u);
  assert.match(html, /<a href="#\/changes">価格変更<\/a>/u);
  assert.match(html, /<a href="#\/history">履歴<\/a>/u);
  assert.doesNotMatch(html, />リクエスト</u);
  assert.doesNotMatch(html, />周期振り分け</u);
  assert.doesNotMatch(html, /crawl-review\.css/u);
  assert.doesNotMatch(html, /crawl-review\.js/u);
});
