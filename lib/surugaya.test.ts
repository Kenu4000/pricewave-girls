import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidSurugayaUrlError,
  normalizePrice,
  normalizeSurugayaUrl,
  parseProductHtml,
} from "./surugaya";

test("販売価格・買取価格・画像・在庫を取得する", () => {
  const product = parseProductHtml(`
    <html>
      <head><meta property="og:image" content="//cdn.suruga-ya.jp/database/pics/example.jpg"></head>
      <body>
        <h1>Windows10/11 DVDソフト ONE. [通常版]</h1>
        <div>中古&nbsp; 3,680円 (税込)</div>
        <a>買取価格： 1,100円</a>
        <button>カートに入れる</button>
        <p>店頭ではすでに品切れの場合もございます。</p>
      </body>
    </html>
  `);

  assert.deepEqual(product, {
    title: "Windows10/11 DVDソフト ONE. [通常版]",
    imageUrl: "https://cdn.suruga-ya.jp/database/pics/example.jpg",
    salePrice: 3680,
    buyPrice: 1100,
    stockStatus: "in_stock",
  });
});

test("タイムセールでは後に表示された現在価格を使う", () => {
  const product = parseProductHtml(`
    <html><body>
      <h1>Windows98/Me/2000/XP CDソフト RUN</h1>
      <div>中古 ※タイムセール 6,000円 5,400円 (税込)</div>
      <button>カートに入れる</button>
    </body></html>
  `);

  assert.equal(product.salePrice, 5400);
  assert.equal(product.stockStatus, "in_stock");
});

test("品切れ時は他ショップ価格を販売価格として扱わない", () => {
  const product = parseProductHtml(`
    <html><body>
      <h1>WindowsXP/Vista DVDソフト eden*</h1>
      <div>他のショップ (5) 6,780円 ～</div>
      <a>買取価格：5,600円</a>
      <p>申し訳ございません。品切れ中です。</p>
    </body></html>
  `);

  assert.equal(product.salePrice, null);
  assert.equal(product.buyPrice, 5600);
  assert.equal(product.stockStatus, "out_of_stock");
});

test("駿河屋の商品URLを正規化する", () => {
  assert.equal(
    normalizeSurugayaUrl(
      "http://www.suruga-ya.jp/product/detail/145078305/?tenpo_cd=400539#price",
    ),
    "https://www.suruga-ya.jp/product/detail/145078305",
  );
});

test("駿河屋を装った別ドメインと商品以外のURLを拒否する", () => {
  assert.throws(
    () => normalizeSurugayaUrl("https://evil-suruga-ya.jp/product/detail/145078305"),
    InvalidSurugayaUrlError,
  );
  assert.throws(
    () => normalizeSurugayaUrl("https://www.suruga-ya.jp/search?search_word=ONE"),
    InvalidSurugayaUrlError,
  );
});

test("全角数字を含む価格を正規化する", () => {
  assert.equal(normalizePrice("￥１２,３４５円"), 12345);
  assert.equal(normalizePrice("価格未定"), null);
});

test("Cloudflareのアクセス確認ページを商品として扱わない", () => {
  assert.throws(
    () =>
      parseProductHtml(`
        <html>
          <head><title>Just a moment...</title></head>
          <body><script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script></body>
        </html>
      `),
    /アクセス確認中のページは取り込めません/,
  );
});
