import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_CRAWL_SOURCE_DETAIL_KEY,
  applySelectedCrawlSourceOffer,
  normalizeSurugayaCrawlSourceUrl,
  resolveProductCrawlSourceUrl,
} from "./product-crawl-source";
import {
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
} from "./product-title-condition";
import type { FetchedProduct } from "./surugaya";

function fetchedProduct(): FetchedProduct {
  return {
    title: "智代アフター ～It’s a Wonderful Life～ PerfectEdition",
    imageUrl: null,
    managementNumber: "145045023",
    manufacturer: "Key",
    releaseDate: "2014/09/26",
    listPrice: 5280,
    modelNumber: "VA-00169D",
    category: "Windows 8/8.1",
    details: { メーカー: "Key" },
    junkItems: [],
    salePrice: null,
    buyPrice: 14000,
    stockStatus: "out_of_stock",
  };
}

const otherShopsHtml = `
  <html><body><table>
    <tr>
      <td>22,540円</td>
      <td><a href="/product/detail/145045023?branch_number=1000&amp;tenpo_cd=400464">中古BOOK欠品</a></td>
      <td>駿河屋柏青葉台店</td>
    </tr>
    <tr>
      <td>23,000円</td>
      <td><a href="/product/detail/145045023?branch_number=9202&amp;tenpo_cd=400394">中古【箱不備（大）（汚れ等イタミ有り）】</a></td>
      <td>駿河屋日本橋オタロード店</td>
    </tr>
  </table></body></html>
`;

const productHtml = `
  <html><body>
    <h1>智代アフター ～It’s a Wonderful Life～ PerfectEdition</h1>
    <p>申し訳ございません。品切れ中です。</p>
    <textarea id="pricewave-other-shops-data">${otherShopsHtml}</textarea>
  </body></html>
`;

test("店舗コードだけのURLからbranch_number付き個体URLを解決する", () => {
  assert.equal(
    resolveProductCrawlSourceUrl(
      "https://www.suruga-ya.jp/product/detail/145045023?tenpo_cd=400464",
      productHtml,
    ),
    "https://www.suruga-ya.jp/product/detail/145045023?tenpo_cd=400464&branch_number=1000",
  );
});

test("店舗個体URLは不要なクエリを落として店舗識別子だけ保持する", () => {
  assert.equal(
    normalizeSurugayaCrawlSourceUrl(
      "https://suruga-ya.jp/product/detail/145045023?foo=bar&branch_number=1000&tenpo_cd=400464",
    ),
    "https://www.suruga-ya.jp/product/detail/145045023?tenpo_cd=400464&branch_number=1000",
  );
});

test("選択店舗のBOOK欠品をランクB価格として主履歴へ反映する", () => {
  const sourceUrl =
    "https://www.suruga-ya.jp/product/detail/145045023?branch_number=1000&tenpo_cd=400464";
  const applied = applySelectedCrawlSourceOffer(fetchedProduct(), sourceUrl, productHtml);

  assert.equal(applied.salePrice, 22540);
  assert.equal(applied.stockStatus, "in_stock");
  assert.equal(applied.details[PRODUCT_CONDITION_DETAIL_KEY], "BOOK欠品");
  assert.equal(applied.details[PRODUCT_CONDITION_RANK_DETAIL_KEY], "B");
});

test("状態文字列へHTML断片が混入してもBOOK欠品だけを保存する", () => {
  const malformedOtherShopsHtml = `
    <html><body><table><tr>
      <td>22,540円</td>
      <td><a href="/product/detail/145045023?branch_number=1000&amp;tenpo_cd=400464">&amp;nbsp;BOOK欠品&quot;&gt; 中古&amp;nbsp;BOOK欠品 &lt;span class=&quot;text-price-detail price-buy&quot;&gt;</a></td>
      <td>駿河屋柏青葉台店</td>
    </tr></table></body></html>
  `;
  const malformedProductHtml = `
    <html><body>
      <textarea id="pricewave-other-shops-data">${malformedOtherShopsHtml}</textarea>
    </body></html>
  `;
  const sourceUrl =
    "https://www.suruga-ya.jp/product/detail/145045023?branch_number=1000&tenpo_cd=400464";
  const applied = applySelectedCrawlSourceOffer(fetchedProduct(), sourceUrl, malformedProductHtml);

  assert.equal(applied.salePrice, 22540);
  assert.equal(applied.details[PRODUCT_CONDITION_DETAIL_KEY], "BOOK欠品");
  assert.equal(applied.details[PRODUCT_CONDITION_RANK_DETAIL_KEY], "B");
});

test("巡回元URLマーカーは商品詳細表示用の情報と分離できる", () => {
  const sourceUrl = normalizeSurugayaCrawlSourceUrl(
    "https://www.suruga-ya.jp/product/detail/145045023?branch_number=1000&tenpo_cd=400464",
  );
  const product = fetchedProduct();
  product.details[PRODUCT_CRAWL_SOURCE_DETAIL_KEY] = sourceUrl;
  assert.equal(product.details[PRODUCT_CRAWL_SOURCE_DETAIL_KEY], sourceUrl);
});
