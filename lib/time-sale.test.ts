import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCT_CONDITION_DETAIL_KEY,
  PRODUCT_CONDITION_RANK_DETAIL_KEY,
} from "./product-title-condition";
import {
  detectPrimaryTimeSale,
  detectPrimaryTimeSaleRegularPrice,
  regularSalePriceFromFetched,
  TIME_SALE_DETAIL_KEY,
  TIME_SALE_REGULAR_PRICE_DETAIL_KEY,
  timeSaleStateFromFetched,
  withProductStateStorageMarkers,
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

test("価格ブロック直前の共通タイムセール表示を検出する", () => {
  const html = `
    <html><body>
      <h1>テスト商品</h1>
      <div class="time-sale">タイムセール</div>
      <div>終了まで</div>
      <div>中古 16,000円 15,000円 (税込) 在庫数：1</div>
    </body></html>
  `;

  assert.equal(detectPrimaryTimeSale(html), true);
  assert.equal(detectPrimaryTimeSaleRegularPrice(html), 16000);
});

test("画像altだけの共通タイムセールバッジも検出する", () => {
  const html = `
    <html><body>
      <h1>テスト商品</h1>
      <img src="/images/flash_sale_icon.svg" alt="タイムセール">
      <div>終了まで</div>
      <div>中古 950円 900円 (税込) 在庫数：1</div>
    </body></html>
  `;

  assert.equal(detectPrimaryTimeSale(html), true);
  assert.equal(detectPrimaryTimeSaleRegularPrice(html), 950);
});

test("タイムセール時の元通常価格を取得する", () => {
  const html = `
    <html><body>
      <h1>テスト商品</h1>
      <div>中古 ※タイムセール 6,000円 5,400円 (税込)</div>
    </body></html>
  `;

  assert.equal(detectPrimaryTimeSaleRegularPrice(html), 6000);

  const fetched = withProductStateStorageMarkers(html, {
    ...fetchedProduct(),
    salePrice: 5400,
  });
  assert.equal(fetched.details[TIME_SALE_REGULAR_PRICE_DETAIL_KEY], "6000");
  assert.equal(regularSalePriceFromFetched(fetched), 6000);
});

test("先に通常価格ブロックがあっても後続のタイムセールを検出する", () => {
  assert.equal(
    detectPrimaryTimeSale(`
      <html><body>
        <h1>テスト商品</h1>
        <div>新品 8,000円 (税込)</div>
        <div>中古 ※ タイム セール 6,000円 5,400円 (税込)</div>
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
        <img src="/images/flash_sale_icon.svg" alt="タイムセール">
        <div>中古 箱不備 5,000円 4,500円 (税込)</div>
      </body></html>
    `),
    false,
  );
});

test("状態難表記をタイトルから外してランクBマーカーへ保存する", () => {
  const original = {
    ...fetchedProduct(),
    title:
      "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition（テクニカルマニュアル欠品）",
    salePrice: 20800,
    buyPrice: 15000,
  };
  const html = `
    <html><body>
      <h1>${original.title}</h1>
      <div>中古 20,800円 (税込)</div>
    </body></html>
  `;
  const marked = withProductStateStorageMarkers(html, original);

  assert.equal(
    marked.title,
    "WindowsVista/7/8 DVDソフト 智代アフター ～It’s a Wonderful Life～ PerfectEdition",
  );
  assert.equal(marked.details[PRODUCT_CONDITION_DETAIL_KEY], "テクニカルマニュアル欠品");
  assert.equal(marked.details[PRODUCT_CONDITION_RANK_DETAIL_KEY], "B");
  assert.equal(timeSaleStateFromFetched(marked), false);
  assert.equal(regularSalePriceFromFetched(marked), 20800);
});

test("保存用マーカーを商品詳細へ追加し元データは変更しない", () => {
  const original = fetchedProduct();
  const marked = withTimeSaleStorageMarker(original, true);

  assert.equal(marked.details[TIME_SALE_DETAIL_KEY], "true");
  assert.equal(timeSaleStateFromFetched(marked), true);
  assert.equal(timeSaleStateFromFetched(original), false);
  assert.equal(original.details[TIME_SALE_DETAIL_KEY], undefined);
  assert.equal(marked.details.メーカー, "テスト");
});
