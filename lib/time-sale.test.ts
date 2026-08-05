import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPrimaryTimeSale,
  TIME_SALE_DETAIL_KEY,
  withTimeSaleStorageMarker,
} from "./time-sale";
import type { FetchedProduct } from "./surugaya";

function fetchedProduct(): FetchedProduct {
  return {
    title: "テスト商品",
    imageUrl: null,
    managementNumber: null,
    manufacturer: null,
    releaseDate: null,
    listPrice: null,
    modelNumber: null,
    category: null,
    details: { メーカー: "テスト" },
    junkItems: [],
    salePrice: 5000,
    buyPrice: 1000,
    stockStatus: "in_stock",
  };
}

test("主商品のタイムセール表示を検出する", () => {
  assert.equal(
    detectPrimaryTimeSale(`
      <html><body>
        <h1>テスト商品</h1>
        <div>中古 ※タイムセール 6,000円 5,400円 (税込)</div>
      </body></html>
    `),
    true,
  );
});

test("その他の状態だけがタイムセールでも主商品は通常価格として扱う", () => {
  assert.equal(
    detectPrimaryTimeSale(`
      <html><body>
        <h1>テスト商品</h1>
        <div>中古 6,000円 (税込)</div>
        <h2>その他の状態を選ぶ</h2>
        <div>中古 箱不備 ※タイムセール 5,000円 4,500円 (税込)</div>
      </body></html>
    `),
    false,
  );
});

test("保存用マーカーを商品詳細へ追加し元データは変更しない", () => {
  const original = fetchedProduct();
  const marked = withTimeSaleStorageMarker(original, true);

  assert.equal(marked.details[TIME_SALE_DETAIL_KEY], "true");
  assert.equal(original.details[TIME_SALE_DETAIL_KEY], undefined);
  assert.equal(marked.details.メーカー, "テスト");
});
