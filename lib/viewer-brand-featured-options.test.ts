import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("Viewerメーカー候補補正スクリプトを構文解析できる", async () => {
  const source = await readFile(
    new URL("../viewer/brand-featured-options.js", import.meta.url),
    "utf8",
  );
  assert.doesNotThrow(() => new vm.Script(source));
});

test("Viewerのよく登録されているメーカーは20件に制限し五十音順で表示する", async () => {
  const source = await readFile(
    new URL("../viewer/brand-featured-options.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /FEATURED_LIMIT = 20/u);
  assert.match(source, /\.slice\(0, FEATURED_LIMIT\)/u);
  assert.match(source, /featured[\s\S]*collator\.compare\(left\.label, right\.label\)/u);
});

test("Viewerの五十音一覧には上段20件も含めた全メーカーを載せる", async () => {
  const source = await readFile(
    new URL("../viewer/brand-featured-options.js", import.meta.url),
    "utf8",
  );
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(source, /const alphabetical = \[\.\.\.optionMap\.values\(\)\]/u);
  assert.doesNotMatch(source, /!featured/u);
  assert.match(source, /group\.label = 'よく登録されているメーカー'/u);
  assert.match(source, /group\.label = '五十音順'/u);
  assert.match(html, /brand-featured-options\.js\?v=202609021236/u);
});
