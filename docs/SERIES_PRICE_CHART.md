# シリーズ価格推移グラフ

最終更新: 2026-09-04

主要実装:
- PR #90 / merge commit `7ac8ce17bd8cff54fbc50e57acaada1d7764130c`
- PR #91 / merge commit `cca82b51a847207d4bb591cde66d091f178152d6`
- PR #92 / merge commit `98288a8e8b6928d31cfb9eeca05a21c797e97f94`
- PR #93 / merge commit `6a0b5d4981c16a43bc39d2c4126777a49a53493b`
- PR #94 / merge commit `c282c77dc46441c2cf646470b3035e39c7f818b3`
- PR #95 / merge commit `7ce233da5348efd384754036c23191fd9f60dedb`
- PR #96 / Viewer対応
- PR #97 / 同名商品のReact key衝突修正
- PR #98 / 公開済みViewer向けシリーズデータ補完
- PR #99 / merge commit `461d5fd87ea8ec19441290b73a6a837218652dee` / ローカル版に買取価格表示を追加

## 目的

商品詳細ページの既存「価格推移」グラフの下に `シリーズ` ボタンを表示し、その商品が属するシリーズの登録済み各商品を1枚のグラフへ重ねて比較する。

ローカルNext.js版ではPR #99以降、`販売 / 買取` を切り替えてシリーズ全商品の販売価格推移または買取価格推移を表示できる。

シリーズ平均・中央値・合計価格、シリーズ編集UI、DBのSeriesモデル、シリーズ単独ページは未実装。

## シリーズ定義

成人向けゲームシリーズ調査表を元に、173シリーズ・1,135タイトルを静的カタログ化している。

- `data/series-catalog-01.json`
- `data/series-catalog-02.json`
- `data/series-catalog-03.json`
- `data/series-catalog-04.json`
- `data/series-catalog-05.json`
- `data/series-catalog-06.json`

DBへシリーズ情報は保存しない。シリーズの正規定義は現時点ではこの静的カタログ。

## 商品タイトルのシリーズ判定

`lib/series-catalog.ts` が担当する。

1. 商品タイトルの状態表記を `splitProductTitleCondition()` で除去する。
2. 駿河屋が先頭へ付ける `WindowsXP/Vista/7/8 DVD ソフト` 等の機種・媒体カテゴリ表記をシリーズ判定時だけ除去する。
3. NFKC正規化・小文字化を行う。
4. 空白とUnicode句読点を除去する。
5. `+`、`×`、`†` などタイトル識別に使う記号は残す。
6. カタログ側タイトルを長い順に照合する。
7. 正規化後の完全一致または前方一致だけを採用する。

部分包含一致は使わない。長いタイトルを優先し、別シリーズへの誤分類を避ける。

## 同一作品の複数登録・edition違い

- 通常品が存在すれば通常品を優先する。
- ランクB/状態違い商品は通常品がある場合はシリーズ線から除外する。
- 通常品が存在しない場合は状態違い商品も利用可能。
- **通常版・廉価版・対応OS版・CD/DVD版など異なる商品IDの価格履歴は絶対に1本へ結合しない。**
- PR #94以降は `1商品ID = 1シリーズ価格線`。
- 同じカタログ作品に対応していてもedition違いは別々の線・別々の履歴として扱う。
- 凡例ではシリーズ判定用に無視する機種・媒体表記もedition識別のため残す。
- 同一表示タイトルが複数ある場合、ローカル版では商品IDを補助表示する。
- 選択・ホバー・React keyはタイトル文字列ではなく商品IDを使う。
- 凡例の商品名を押すと、その商品IDの商品詳細へ移動する。

重要: シリーズ判定用の正規化タイトルと、グラフで表示する実商品タイトルを混同しないこと。

## ローカル商品詳細ページ

`app/products/[id]/page.tsx` で現在の商品からシリーズを判定する。

シリーズが見つかった場合のみ:

1. 登録商品のID・タイトル・状態を取得する。
2. `buildSeriesProductGroups()` でシリーズ内の商品へ分類する。
3. edition違いを商品ID単位の別グループとして保持する。
4. 対象商品の `PriceHistory` から `salePrice` と `buyPrice` の両方を取得する。
5. 各線には1つの商品IDの履歴だけを渡す。
6. `SeriesPriceChart` へ渡す。

既存の `PriceChart` は変更せず、その直下にシリーズUIを置く。

## SeriesPriceChart

`components/SeriesPriceChart.tsx`

初期状態では `シリーズ` ボタンだけを表示する。

押下後:

- シリーズ名
- `販売 / 買取` 切替
- 選択中の価格種別に履歴が存在する商品数 / カタログ定義作品数
- 同シリーズ各商品の価格推移
- 各商品の最新価格を含む凡例
- `日（全期間） / 週 / 月`
- 選択時点の各商品価格readout
- `自動 / 通常 / 対数` の縦軸切替

を表示する。

### 販売 / 買取

PR #99以降、ローカル版では同じシリーズグラフ内で価格種別を切り替える。

- `販売`: `salePrice` を表示する。
- `買取`: `buyPrice` を表示する。
- 買取価格でもedition違いは1商品ID=1本の線。
- 買取履歴が1件も存在しないシリーズでは `買取` ボタンを無効化する。
- 販売/買取の切替時には選択時点と固定強調をリセットする。
- 日週月の集約は既存 `aggregatePriceChartData()` を共用する。

販売価格と買取価格を同じ縦軸へ同時重畳するのではなく、比較対象商品を保ったまま価格種別を切り替える方式。

### 通常価格グラフに近い操作

- `日（全期間） / 週 / 月` は `PriceChart` と同じ集約ロジックを使用する。
- グラフ上でポインタを動かすと最寄りの取得時点を選択する。
- 選択時点を縦線と各商品上のポイントで示す。
- グラフ上部に、その時点までに取得済みの各商品価格を表示する。
- 凡例の商品名から `/products/[id]` へ移動する。
- 凡例ホバーで対応する線を強調する。
- 線をクリックすると強調状態を固定・解除できる。

### 縦軸

- `自動 / 通常 / 対数` を切替可能。
- 初期値は `自動`。
- 最大価格 / 最小価格が8倍以上ですべて正なら自動的に対数目盛を使う。
- `通常` は線形表示。
- 縦軸ラベルは `11,000円` のような実価格を表示する。
- 対数目盛でもラベルは実際の円価格。

## GitHub Pages Viewer

PR #96でViewerにもシリーズ価格グラフを追加した。PR #98で、公開済みViewerにシリーズJSONが未生成でも既存の商品JSONから補完できるfallbackを追加した。

主なファイル:

- `scripts/export-viewer-series-data.ts`
- `viewer/series-price-chart.js`
- `viewer/series-price-chart.css`
- `viewer/series-price-data-fallback.js`
- `viewer-dist/data/series-index.json`
- `viewer-dist/data/series/<seriesId>.json`

Viewer側もedition違いを商品IDごとに分離し、凡例から `#/products/[id]` へ移動できる。

**PR #99の買取価格切替は現時点ではローカルNext.js版のみ。Viewerのシリーズグラフは販売価格表示のまま。** Viewerへ買取価格を追加する場合は、Viewer出力JSON・fallback・`series-price-chart.js`の3箇所すべてで `buyPrice` を扱うこと。

`home-ui.js` は引き続きViewerで最後のscriptとして読み込むこと。

## 現時点で未実装

- Viewerシリーズグラフの買取価格切替
- シリーズ平均価格
- シリーズ中央値
- シリーズ全取得価格
- シリーズ所属の編集画面
- Series / SeriesProduct Prismaモデル
- シリーズ単独ページ

## 回帰テスト

- `lib/series-catalog.test.ts`
- `lib/series-price-chart-ui.test.ts`
- `lib/viewer-series-price-chart.test.ts`

PR #99では `npm test`、`npm run typecheck`、`npm run build` のCI成功を確認済み。
