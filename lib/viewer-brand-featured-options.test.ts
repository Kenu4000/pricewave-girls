import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function source() {
  return readFile(new URL("../viewer/brand-featured-options.js", import.meta.url), "utf8");
}

test("Viewerメーカー候補補正スクリプトを構文解析できる", async () => {
  const text = await source();
  assert.doesNotThrow(() => new vm.Script(text));
});

test("Viewerの自動注目メーカーは20件を上限にし指定追加は別枠にする", async () => {
  const text = await source();
  assert.match(text, /FEATURED_LIMIT = 20/u);
  assert.match(text, /const automatic =[\s\S]*\.slice\(0, FEATURED_LIMIT\)/u);
  assert.match(text, /const pinned = FEATURED_PINNED_BRANDS/u);
  assert.match(text, /featured: \[\.\.\.automatic, \.\.\.pinned\]/u);
  assert.match(text, /collator\.compare\(left\.label, right\.label\)/u);
});

test("Viewerの注目枠からBEEPとAiNOを除外し指定5メーカーを追加する", async () => {
  const text = await source();
  assert.match(text, /FEATURED_EXCLUDED_SOURCE_KEYS[\s\S]*BEEP[\s\S]*AiNO/u);
  assert.match(text, /FEATURED_PINNED_BRANDS[\s\S]*暁[\s\S]*あっぷりけ[\s\S]*パープルソフトウェア[\s\S]*Navel[\s\S]*ぱれっと/u);
});

test("Viewerのブランド欄はmain同様に五十音順と巡回停止を分離する", async () => {
  const text = await source();
  const html = await readFile(new URL("../viewer/index.html", import.meta.url), "utf8");

  assert.match(text, /const alphabetical = \[\.\.\.optionMap\.values\(\)\][\s\S]*!stoppedSet\.has\(option\.key\)/u);
  assert.match(text, /appendGroup\(nodes, 'よく登録されているメーカー',/u);
  assert.match(text, /appendGroup\(nodes, '五十音順',/u);
  assert.match(text, /appendGroup\(nodes, '巡回停止',/u);
  assert.match(text, /profile\.active === 0/u);
  assert.match(html, /brand-featured-options\.js\?v=202609041107/u);
});

test("Viewerの製品数が多い順はブランド欄と別の選択欄にする", async () => {
  const text = await source();
  assert.match(text, /label\.textContent = '製品数が多い順'/u);
  assert.match(text, /select\.id = 'brand-product-count'/u);
  assert.match(text, /profile\.active > 0/u);
  assert.match(text, /right\.total - left\.total/u);
  assert.match(text, /mainBrandCountOrder/u);
});
