import assert from "node:assert/strict";
import test from "node:test";
import {
  InvalidSurugayaUrlError,
  extractOtherShopItems,
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
    managementNumber: null,
    manufacturer: null,
    releaseDate: null,
    listPrice: null,
    modelNumber: null,
    category: null,
    details: {},
    junkItems: [],
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

test("その他の状態を通常価格と分離して一件ずつ取得する", () => {
  const product = parseProductHtml(`
    <html><body>
      <h1>ファミコンソフト ソルスティス</h1>
      <div>中古 9,200円 (税込)</div>
      <h2>その他の状態を選ぶ</h2>
      <div>中古 箱・ジャケット・ケース不備（中） 6,500円 (税込)</div>
      <div>中古 本体不備（大） 5,500円 (税込)</div>
      <div>中古 帯付き ※タイムセール 3,900円 3,500円 (税込)</div>
      <p>条件により送料とは別に通信販売手数料がかかります</p>
      <a>買取価格： 4,200円</a>
    </body></html>
  `);

  assert.equal(product.salePrice, 9200);
  assert.deepEqual(product.junkItems, [
    {
      sourceType: "alternate_condition",
      storeName: null,
      condition: "中古 箱・ジャケット・ケース不備（中）",
      price: 6500,
    },
    {
      sourceType: "alternate_condition",
      storeName: null,
      condition: "中古 本体不備（大）",
      price: 5500,
    },
    {
      sourceType: "alternate_condition",
      storeName: null,
      condition: "中古 帯付き",
      price: 3500,
    },
  ]);
});

test("他ショップ一覧から店舗名・状態・価格を取得する", () => {
  const items = extractOtherShopItems(`
    <html><body>
      <table>
        <thead>
          <tr><th>価格</th><th>コンディション</th><th>販売</th><th>配送</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1,460円</td>
            <td>中古 箱不備（小）</td>
            <td><a>駿河屋高槻店の出品を見る</a> 5.0(2661件)</td>
            <td>5日〜10日以内に発送します</td>
          </tr>
          <tr>
            <td>1,510円</td>
            <td>中古 箱・ジャケット・ケース不備（中）</td>
            <td>駿河屋 町田旭町店 5.0(1993件)</td>
            <td>配送料 および 返品について。</td>
          </tr>
        </tbody>
      </table>
    </body></html>
  `);

  assert.deepEqual(items, [
    {
      sourceType: "other_shop",
      storeName: "駿河屋高槻店",
      condition: "中古 箱不備（小）",
      price: 1460,
    },
    {
      sourceType: "other_shop",
      storeName: "駿河屋 町田旭町店",
      condition: "中古 箱・ジャケット・ケース不備（中）",
      price: 1510,
    },
  ]);
});

test("商品ページへ埋め込まれた他ショップ一覧をジャンク履歴候補へ統合する", () => {
  const product = parseProductHtml(`
    <html><body>
      <h1>Windows DVDソフト テストゲーム</h1>
      <div>中古 3,000円 (税込)</div>
      <textarea id="pricewave-other-shops-data" hidden>
        &lt;html&gt;&lt;body&gt;&lt;table&gt;&lt;tr&gt;
        &lt;td&gt;2,500円&lt;/td&gt;
        &lt;td&gt;中古 ディスクのみ&lt;/td&gt;
        &lt;td&gt;&lt;a&gt;駿河屋大阪店の出品を見る&lt;/a&gt;&lt;/td&gt;
        &lt;/tr&gt;&lt;/table&gt;&lt;/body&gt;&lt;/html&gt;
      </textarea>
    </body></html>
  `);

  assert.deepEqual(product.junkItems, [
    {
      sourceType: "other_shop",
      storeName: "駿河屋大阪店",
      condition: "中古 ディスクのみ",
      price: 2500,
    },
  ]);
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
  assert.equal(
    normalizeSurugayaUrl("https://www.suruga-ya.jp/product/detail/ZHOU103337"),
    "https://www.suruga-ya.jp/product/detail/ZHOU103337",
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
  assert.equal(normalizePrice("￥１２，３４５円"), 12345);
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

test("駿河屋の商品詳細情報を取得する", () => {
  const product = parseProductHtml(`
    <html><body>
      <h1>Windows10/11 DVDソフト ONE. [通常版]</h1>
      <h3>商品詳細情報</h3>
      <table>
        <tr>
          <th>管理番号</th><td>中古 ：145078305001</td>
          <th>メーカー</th><td>novamicus</td>
          <th>発売日</th><td>2023/12/22</td>
        </tr>
        <tr>
          <th>定価</th><td>8,250円</td>
          <th>型番</th><td>NVM001</td>
          <th>原画</th><td>樋上いたる</td>
        </tr>
        <tr>
          <th>シナリオ</th><td>Tactics</td>
          <th>対応OS</th><td>Windows 10/11</td>
        </tr>
      </table>
      <h3>備考</h3>
    </body></html>
  `);

  assert.equal(product.managementNumber, "145078305001");
  assert.equal(product.manufacturer, "novamicus");
  assert.equal(product.releaseDate, "2023-12-22");
  assert.equal(product.listPrice, 8250);
  assert.equal(product.modelNumber, "NVM001");
  assert.equal(product.details["原画"], "樋上いたる");
  assert.equal(product.details["シナリオ"], "Tactics");
  assert.equal(product.details["対応OS"], "Windows 10/11");
});
