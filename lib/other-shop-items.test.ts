import assert from "node:assert/strict";
import test from "node:test";
import {
  extractOtherShopItemsSafely,
  replaceEmbeddedOtherShopItems,
} from "./other-shop-items";
import type { FetchedProduct } from "./surugaya";

const marketplaceHtml = `
<html><body>
  <table class="product-detail">
    <tr><th>管理番号</th><td>中古 ：145045023001</td><th>メーカー</th><td>Key</td></tr>
    <tr><th>定価</th><td>5,280円</td><th>型番</th><td>VA-00169D</td></tr>
  </table>
  <div class="marketplace-offer">
    <div class="price">22,540円</div>
    <a href="/product/detail/145045023?branch_number=1000&tenpo_cd=400464">中古BOOK欠品</a>
    <a href="/search?category=&search_word=&tenpo_code=400464">駿河屋柏青葉台店</a>
    <a href="/search?category=&search_word=&tenpo_code=400464">駿河屋柏青葉台店の出品を見る</a>
  </div>
  <div class="marketplace-offer">
    <div class="price">23,000円</div>
    <a href="/product/detail/145045023?branch_number=9202&tenpo_cd=400394">中古【箱不備（大）（汚れ等イタミ有り）】</a>
    <a href="/search?tenpo_code=400394">駿河屋日本橋オタロード店の出品を見る</a>
  </div>
</body></html>`;

test("商品詳細表を店舗出品として誤認せずtenpo_cd付き出品を取得する", () => {
  assert.deepEqual(extractOtherShopItemsSafely(marketplaceHtml), [
    {
      sourceType: "other_shop",
      storeName: "駿河屋柏青葉台店",
      condition: "中古BOOK欠品",
      price: 22540,
    },
    {
      sourceType: "other_shop",
      storeName: "駿河屋日本橋オタロード店",
      condition: "中古【箱不備（大）（汚れ等イタミ有り）】",
      price: 23000,
    },
  ]);
});

test("店舗出品の単独ランクB表記を取得する", () => {
  assert.deepEqual(
    extractOtherShopItemsSafely(`
      <div class="marketplace-offer">
        <span>18,000円</span>
        <a href="/product/detail/145045023?branch_number=1000&tenpo_cd=400464">ランクB</a>
        <a href="/search?tenpo_code=400464">駿河屋柏青葉台店の出品を見る</a>
      </div>
    `),
    [
      {
        sourceType: "other_shop",
        storeName: "駿河屋柏青葉台店",
        condition: "ランクB",
        price: 18000,
      },
    ],
  );
});

test("埋め込み他店舗HTMLの旧誤解析結果を安全パーサの結果へ置換する", () => {
  const fetched: FetchedProduct = {
    title: "智代アフター",
    imageUrl: null,
    managementNumber: null,
    manufacturer: null,
    releaseDate: null,
    listPrice: null,
    modelNumber: null,
    category: null,
    details: {},
    salePrice: null,
    buyPrice: null,
    stockStatus: "out_of_stock",
    junkItems: [
      {
        sourceType: "other_shop",
        storeName: "メーカー",
        condition: "中古 ：145045023001",
        price: 5280,
      },
    ],
  };
  const encoded = marketplaceHtml
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const productHtml = `<textarea id="pricewave-other-shops-data" data-state="ready">${encoded}</textarea>`;
  const replaced = replaceEmbeddedOtherShopItems(productHtml, fetched);

  assert.equal(replaced.junkItems.some((item) => item.storeName === "メーカー"), false);
  assert.equal(replaced.junkItems.length, 2);
  assert.equal(replaced.junkItems[0]?.storeName, "駿河屋柏青葉台店");
});
