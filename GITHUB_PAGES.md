# GitHub Pages 閲覧版

メインPCだけで駿河屋を取得し、SQLiteへ保存します。GitHub PagesにはDBそのものではなく、閲覧専用に変換した最新スナップショットだけを公開します。

## 構成

- `main`
  - Next.js本体
  - Edge拡張機能
  - SQLiteを読むローカルアプリ
  - 閲覧用サイトのソース
- `prisma/dev.db`
  - メインPCにだけ存在
  - GitHubへは送らない
- `gh-pages`
  - `viewer-dist` の生成結果だけを置く
  - 公開時に毎回最新スナップショット1コミットへ置き換える
- スマホ・別PC
  - GitHub Pagesをブラウザで開くだけ
  - メインPCへの直接接続や拡張機能は不要

## 初回設定

1. この変更をmainへ取り込んで `git pull` する
2. メインPCで通常どおり `npm install` / `start-tracker.cmd` を使用する
3. 価格データがある状態で `publish-viewer.cmd` を実行する
4. GitHubのリポジトリで `Settings > Pages` を開く
5. `Build and deployment` のSourceを `Deploy from a branch` にする
6. Branchを `gh-pages`、Folderを `/(root)` にして保存する

プロジェクトPagesの場合、通常は次のURLで閲覧できます。

`https://Kenu4000.github.io/pricewave-girls/`

## データ更新

価格取得が終わった後に、メインPCで次のどちらかを実行します。

```bash
npm run viewer:publish
```

またはWindowsで `publish-viewer.cmd` をダブルクリックします。

処理内容は次の通りです。

1. SQLiteから商品一覧・価格変更・全価格履歴・ジャンク履歴を読み出す
2. `viewer-dist` に静的HTML/CSS/JSとJSONを書き出す
3. 一時Gitリポジトリを作る
4. `gh-pages` ブランチを最新スナップショットだけでforce更新する
5. GitHub Pages側が新しい内容を配信する

本体の `main` ブランチへ日々の価格データをコミットしないため、通常の開発履歴とは分離されます。

## 閲覧版で使えるもの

- 商品一覧
- 商品名検索
- ブランド絞り込み
- 更新順・価格順・発売日順・商品名順
- 商品詳細
- 保存済み全価格履歴の推移グラフ
- 直近10件＋過去の異なる価格の価格履歴表
- ジャンク・他ショップ履歴
- 価格変更一覧（未取得を含む変更は除外）
- タイムセール表示と終了カウントダウン
- 端末ごとの閲覧履歴40件
- スマホ用レイアウト

閲覧版には商品追加・価格取得・削除などの書き込み機能は置きません。

## 公開範囲

このリポジトリはpublicです。GitHub Pagesへ書き出した商品名・価格・履歴も公開情報になります。SQLiteファイル、ブラウザ状態、ローカル設定は公開しません。
