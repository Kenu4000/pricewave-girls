# Viewer 分割データ・遅延読み込み

最終更新: 2026-09-09

## 目的

GitHub Pages Viewerの初期表示で、1万件を超える全商品要約・全文検索文字列・価格変更履歴を1つの `data/index.json` として一括取得しない。

SQLiteを唯一の正本とする方針は変更しない。分割JSONはすべて `viewer:export` のたびにSQLiteの最新状態から作り直す。そのため、新商品や新しい価格履歴が増えても手作業でファイルを振り分ける必要はない。

## 出力ファイル

`scripts/export-viewer-data.ts` は毎回次を生成する。

- `data/index.json`
  - 初回bootstrap専用。
  - `generatedAt`、`productCount`、タイムセール終了カウントダウンに必要な商品だけを保持する。
  - 全商品一覧、全文検索文字列、価格変更履歴は入れない。
- `data/changes.json`
  - 価格変更画面用の価格変更履歴。
- `data/products.json`
  - 商品一覧・履歴・シリーズ補完に使う全商品要約。
  - `searchText` は含めない。
- `data/search-index.json`
  - 商品IDごとの `searchText`。
  - 実際に検索フォームを送信したときだけ読み込む。
- `data/detail-index.json`
  - 原画、シナリオ、声優などの詳細検索索引。
  - `mobile-search.js` が起動時に要求しても、商品一覧を開くまでネットワーク取得を保留する。
- `data/products/<id>.json`
  - 従来どおり商品詳細を開いたときだけ取得する。
- `data/series/*.json`
  - 従来どおりシリーズ価格グラフ用。

分割JSONは転送量を減らすためpretty printを行わず `JSON.stringify(value)` で出力する。商品詳細JSONはデバッグ性を優先し従来どおり整形出力のまま。

## 他店舗スナップショットの大量出力

`viewer:export` は `.pricewave-snapshots/other-shops/*.json` も `viewer-dist/data/other-shops/` へコピーする。

2026-09-09時点で8,000件を超えるスナップショットを `Promise.all` で一度に読み書きすると、Windowsで `EMFILE: too many open files` が発生した。そのため `exportOtherShopSnapshots()` は **32件ずつ** のバッチで読み書きする。

- 同時に数千ファイルを開かない。
- 全件を順次バッチ処理するため、出力内容は従来と同じ。
- `ENOENT`（スナップショットディレクトリ自体がない）は従来どおり無視する。
- バッチサイズは `OTHER_SHOP_SNAPSHOT_EXPORT_BATCH_SIZE` で固定し、無制限 `Promise.all` に戻さない。

## 読み込み順

`viewer/lazy-data.js` は `app.js` の直後に読み込む。

- `#/changes`
  - bootstrap読込後、`changes.json`だけを取得して表示する。
  - `products.json`、`search-index.json`、`detail-index.json` は取得しない。
- `#/products`
  - `products.json` と、注目度ソート互換のため `changes.json` を取得する。
  - `detail-index.json` の保留を解除する。
- `#/history`
  - 商品IDから一覧要約を引く必要があるため `products.json` を取得する。
- `#/products/<id>`
  - 全商品一覧を取得せず、従来どおり `data/products/<id>.json` を直接取得する。
- 検索フォーム送信
  - 初回だけ `search-index.json` を取得し、読み込み後に同じsubmitを再実行する。

`home-ui.js` は引き続き静的script列の最後に置く。

## 互換性

分割ファイルをまだ持たない古い `gh-pages` snapshotに新しい静的JSだけが載った場合でも壊さない。

- `lazy-data.js` は分割JSONが404なら旧 `data/index.json` へfallbackする。
- `series-price-data-fallback.js` は通常 `data/products.json` を使い、404なら旧 `data/index.json` を使う。

次回 `viewer:publish` が走れば、`publish-viewer.mjs` が必ず `viewer:export` を先に実行するため、分割ファイル一式が最新DBから生成される。

## 回帰条件

- 初期 `data/index.json` に全商品要約を戻さない。
- `searchText` を `products.json` に戻さない。
- 価格変更トップで `products.json` / `search-index.json` / `detail-index.json` を要求しない。
- 商品一覧の「注目度が高い順」は従来どおり価格変更履歴を使うため、一覧表示前に `changes.json` を利用可能にする。
- 商品詳細単独表示では全商品一覧を取得しない。
- 新規取得商品は次回 `viewer:export` で各用途別JSONへ自動反映される。
- 他店舗スナップショット出力で全ファイルを無制限に同時openしない。

関連テスト: `lib/viewer-lazy-data-loading.test.ts`、`lib/viewer-mobile-search.test.ts`、`lib/viewer-series-price-chart.test.ts`、`lib/other-shop-html-snapshot-export.test.ts`。
