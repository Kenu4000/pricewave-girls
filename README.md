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

## 作らない機能

この初期実装では、ログイン・cron・通知・CSV出力・候補収集・公開サービス向け機能は含めていません。

## 起動手順

Node.js 20.9以上を使用します。

```bash
npm install
npx prisma migrate dev
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

## 駿河屋HTML解析

駿河屋ページの取得は `lib/surugaya-browser.ts`、HTML解析は `lib/surugaya.ts` に分離しています。通常のHTTP取得はCloudflareから403を返されるため、Playwrightで実際のブラウザを起動して取得します。

初回取得で「アクセス確認を通過できませんでした」と表示された場合は、`.env`に次を追加して開発サーバーを再起動してください。商品追加または手動更新時にEdgeが開くので、画面にアクセス確認が出た場合は完了させます。確認結果は`.pricewave-browser`に保持されます。

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
- 同時取得は直列化し、駿河屋への過剰なアクセスを避けます。

## 検証

```bash
npm test
npm run typecheck
npm run build
```
