import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSurugayaOtherShopUrl } from "./surugaya-other-shop-url";

test("商品詳細URLから駿河屋の他店舗一覧URLを作る", () => {
  assert.equal(
    buildSurugayaOtherShopUrl("https://www.suruga-ya.jp/product/detail/145070597"),
    "https://www.suruga-ya.jp/product/other/145070597",
  );
  assert.equal(
    buildSurugayaOtherShopUrl("https://suruga-ya.jp/product/other/145070597"),
    "https://www.suruga-ya.jp/product/other/145070597",
  );
});

test("駿河屋以外や商品URL以外は埋め込みURLにしない", () => {
  assert.equal(buildSurugayaOtherShopUrl("https://example.com/product/detail/145070597"), null);
  assert.equal(buildSurugayaOtherShopUrl("https://www.suruga-ya.jp/search?category=1"), null);
});

test("ローカル商品詳細は販売中の保存行ではなく他店舗一覧iframeを表示する", () => {
  const component = readFileSync(
    new URL("../components/JunkHistorySections.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /<h3>販売中<\/h3>/u);
  assert.match(component, /<iframe/u);
  assert.match(component, /src=\{otherShopUrl\}/u);
  assert.doesNotMatch(component, /groups=\{sections\.current\}/u);
  assert.match(component, /groups=\{sections\.past\}/u);
});

test("Viewerも販売中を他店舗一覧へ置換し現在スナップショットは表に出さない", () => {
  const script = readFileSync(
    new URL("../viewer/other-shop-embed.js", import.meta.url),
    "utf8",
  );
  const html = readFileSync(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(script, /\/product\/other\/\$\{match\[1\]\}/u);
  assert.match(script, /currentKey/u);
  assert.match(script, /if \(group\.key === currentKey\) continue;/u);
  assert.match(script, /class=\"other-shop-frame\"/u);
  assert.match(script, /renderProduct = async function renderProductWithOtherShopEmbed/u);
  assert.match(html, /other-shop-embed\.css/u);
  assert.match(html, /other-shop-embed\.js/u);
});
