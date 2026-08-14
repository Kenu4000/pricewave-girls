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

test("ローカル商品詳細は一度取得した他店舗データをレスポンシブ表示する", () => {
  const component = readFileSync(
    new URL("../components/JunkHistorySections.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../components/JunkHistorySections.module.css", import.meta.url),
    "utf8",
  );
  assert.match(component, /<h3>販売中<\/h3>/u);
  assert.match(component, /otherShopSnapshot\.items/u);
  assert.match(component, /styles\.surugayaList/u);
  assert.match(component, /groups=\{sections\.past\}/u);
  assert.doesNotMatch(component, /<iframe/u);
  assert.doesNotMatch(component, /variant=desktop|variant=mobile/u);
  assert.doesNotMatch(component, /desktopCapturedAt|mobileCapturedAt/u);
  assert.match(css, /@media \(max-width: 720px\)/u);
  assert.match(css, /grid-template-columns: 1fr auto/u);
});

test("Viewerも同じ他店舗データをPC・モバイル幅で描き分ける", () => {
  const script = readFileSync(
    new URL("../viewer/other-shop-embed.js", import.meta.url),
    "utf8",
  );
  const css = readFileSync(new URL("../viewer/other-shop-embed.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../viewer/index.html", import.meta.url), "utf8");
  assert.match(script, /detail\.otherShopSnapshot/u);
  assert.match(script, /snapshot\?\.items/u);
  assert.match(script, /viewerCurrentOfferList/u);
  assert.match(script, /viewerJunkHistorySections/u);
  assert.doesNotMatch(script, /<iframe/u);
  assert.doesNotMatch(script, /desktopPath|mobilePath/u);
  assert.match(script, /renderProduct = async function renderProductWithOtherShopEmbed/u);
  assert.match(css, /@media\(max-width:760px\)/u);
  assert.match(css, /grid-template-columns:1fr auto/u);
  assert.match(html, /other-shop-embed\.css/u);
  assert.match(html, /other-shop-embed\.js/u);
});
