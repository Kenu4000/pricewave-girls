# pricewave-girls

個人利用向けの駿河屋PCゲーム価格記録Webアプリです。駿河屋の商品URLを登録し、販売価格・買取価格・在庫状態を手動で取得して履歴保存します。

## 技術構成

- Next.js
- TypeScript
- Prisma
- SQLite
- Recharts
- cheerio
- Playwright

## 初期実装の機能

- 商品URL登録（`/add`）
- 商品一覧表示（`/products`）
- 商品詳細表示（`/products/[id]`）
- 販売価格・買取価格・在庫状態の履歴保存
- Recharts による価格推移グラフ
- 商品詳細画面からの手動更新
- Edgeで表示中の商品ページを拡張機能から記録
- 商品一覧を24・48・96件単位でページ分割
- 更新日時・価格・発売日・定価・メーカー・商品名による並び替え
- 駿河屋の商品詳細情報（管理番号・メーカー・発売日・定価・型番など）を保存

## 作らない機能

この初期実装では、ログイン・cron・通知・CSV出力・候補収集・公開サービス向け機能は含めていません。

## 起動手順

Node.js 20.9以上を使用します。

```bash
npm install
npm run prisma:migrate
npm run dev
```

起動後、ブラウザで <http://localhost:3000> を開くと `/products` にリダイレクトされます。

Windowsでは、PCにインストール済みのMicrosoft Edgeを価格取得に使用します。Edgeを使用しない場合は、次のコマンドでPlaywright用Chromiumを追加してください。

```bash
npx playwright install chromium
```

## Prisma / SQLite

SQLite の接続先は `.env` の `DATABASE_URL` で設定します。初期値は次の通りです。

```env
DATABASE_URL="file:./dev.db"
```

`npx prisma migrate dev` を実行すると `prisma/dev.db` が作成されます。DBファイルは開発用のローカルデータとして `.gitignore` しています。

## Edge拡張機能からの記録（推奨）

Cloudflareのアクセス確認により自動取得できない環境では、通常のEdgeで商品ページを開き、同梱の拡張機能から表示内容をPriceWaveへ渡します。この方式はアクセス確認を回避せず、ユーザーが通常閲覧できたページだけを記録します。

1. Edgeで `edge://extensions` を開く
2. 左側の「開発者モード」をオンにする
3. 「展開して読み込み」を押す
4. リポジトリ内の `browser-extension` フォルダーを選ぶ
5. 駿河屋の商品詳細ページを開く
6. 「PriceWave 駿河屋取込」から「この商品を記録」を押す

PriceWaveは `npm run dev` で起動しておく必要があります。同じ商品で再実行すると、新しい価格履歴が追加されます。

既に登録済みの商品は、拡張機能からもう一度記録すると商品詳細情報が補完されます。商品によって存在する項目が異なるため、管理番号・メーカー・発売日・定価・型番・カテゴリは専用列へ保存し、それ以外の項目も詳細画面で一覧表示します。

## 自動取得（利用できる環境のみ）

駿河屋ページの取得は `lib/surugaya-browser.ts`、HTML解析は `lib/surugaya.ts` に分離しています。通常のHTTP取得はCloudflareから403を返されるため、Playwrightで実際のブラウザを起動して取得します。ただし、Playwrightでもアクセス確認が自動完了しない環境では使用できません。

初回取得で「アクセス確認を通過できませんでした」と表示された場合は、`.env`に次を追加して開発サーバーを再起動すると、商品追加または手動更新時のブラウザ状態を確認できます。アクセス確認が自動で完了しない場合、この方式では価格を取得できません。自動で完了した確認結果は`.pricewave-browser`に保持されます。

```env
SURUGAYA_BROWSER_HEADLESS=false
```

必要に応じて次の環境変数も指定できます。

```env
# msedge / chrome / chromium など。Windowsの既定値はmsedge
SURUGAYA_BROWSER_CHANNEL=msedge
# 任意のブラウザ実行ファイルを直接指定する場合
SURUGAYA_BROWSER_EXECUTABLE_PATH=C:\path\to\chrome.exe
# プロキシが必要な環境だけ指定（HTTPS_PROXY / HTTP_PROXYも自動認識）
SURUGAYA_BROWSER_PROXY=http://proxy.example:8080
# 独自証明書を使う開発用プロキシに限りtrue
SURUGAYA_BROWSER_IGNORE_HTTPS_ERRORS=false
# ページ取得の待機時間（ミリ秒、最小5000）
SURUGAYA_BROWSER_TIMEOUT_MS=45000
```

注意点:

- 商品画像は保存せず、画像URLのみ保存します。
- 買取価格が取れない場合は `null` として正常扱いします。
- 販売価格が取れない場合も `null` として正常扱いします。
- 在庫状態が判定できない場合は `unknown` として保存します。
- ページ取得に失敗した場合、価格履歴は追加しません。
- 拡張機能はEdgeで現在表示しているページだけを記録し、自動巡回はしません。
- 同時取得は直列化し、駿河屋への過剰なアクセスを避けます。

## 検証

```bash
npm test
npm run typecheck
npm run build
```
