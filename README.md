# pricewave-girls

個人利用向けの駿河屋PCゲーム価格記録Webアプリです。駿河屋の商品URLを登録し、販売価格・買取価格・在庫状態を手動で取得して履歴保存します。

## 技術構成

- Next.js
- TypeScript
- Prisma
- SQLite
- Recharts
- cheerio

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

```bash
npm install
npx prisma migrate dev
npm run dev
```

起動後、ブラウザで <http://localhost:3000> を開くと `/products` にリダイレクトされます。

## Prisma / SQLite

SQLite の接続先は `.env` の `DATABASE_URL` で設定します。初期値は次の通りです。

```env
DATABASE_URL="file:./dev.db"
```

`npx prisma migrate dev` を実行すると `prisma/dev.db` が作成されます。DBファイルは開発用のローカルデータとして `.gitignore` しています。

## 駿河屋HTML解析

駿河屋ページの取得・HTML解析は `lib/surugaya.ts` に分離しています。HTML構造変更に対応しやすいよう、利用するセレクタは `SELECTORS` にまとめています。

注意点:

- 商品画像は保存せず、画像URLのみ保存します。
- 買取価格が取れない場合は `null` として正常扱いします。
- 販売価格が取れない場合も `null` として正常扱いします。
- 在庫状態が判定できない場合は `unknown` として保存します。
- ページ取得に失敗した場合、価格履歴は追加しません。
