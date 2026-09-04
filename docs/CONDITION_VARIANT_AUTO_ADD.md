# 状態違い商品の自動追加・タイトル正規化

最終更新: 2026-09-04

## 方針

駿河屋で別の商品詳細IDを持っていても、`(状態：○○欠品)`、`ランクB` 等は通常版・廉価版・対応OS版のようなeditionではなく「状態違い」として扱う。

- シリーズ価格グラフでは状態違いをeditionとして別カウントしない。
- PR #101以降、通常品の有無に関係なく状態違いProductをシリーズ線へ代用しない。
- 新商品自動追加の検索一覧では、タイトルから明確に状態違いと判定できる商品URLを追加候補から除外する。
- editionを識別する後続表記（例: `（Windows 10）`）は状態括弧を除去した後もタイトルに残す。

例:

`サクラノ刻 [通常版](状態：オフィシャルアートワーク欠品)（Windows 10）`

は次のように分離する。

- title: `サクラノ刻 [通常版]（Windows 10）`
- condition: `オフィシャルアートワーク欠品`
- conditionRank: `B`

状態文中に `箱(内箱含む)状態難` のような入れ子括弧があっても、外側の状態括弧を正しく認識する。

## 過去実装との比較

旧拡張の未登録商品追加は、少なくともPR #20以前は `background.js` の既定URLとして

`category=65204&genre2=ビジュアルノベル(美少女ゲーム)&search_word=`

を使っていた。

2026-08-08のPR #20（commit `005e318f29b50545c29eb0a22b11b1447943c9c0`）で、発売日順の新商品探索wrapperが入り、既定探索範囲が

`category=6520422&adult_s=3&rankBy=release_date(int):descending`

のアダルトPCソフト全体へ拡大した。旧実装より探索対象そのものが広がったため、駿河屋上で別商品IDを持つ欠品・状態難個体も検索結果へ混ざりやすくなった。

したがって今回の対策では、探索範囲を旧URLへ戻して問題を隠すのではなく、現在の広い探索範囲を維持したまま「状態違いは未登録の新editionではない」と判定して除外する。

2026-09-04に、駿河屋側の検索設定で「品切れ表示」を有効にしていたことで、状態違いProductが同じ作品の別カードとして多数見える事象が発生した。17:59台にそれらの `PriceHistory.checkedAt` が集中している一方、`Product.createdAt` を当日範囲で照合しても0件になるDBが確認された。

このため「画面上でその時刻に新しく現れたカード」を消す運用では、`Product.createdAt` だけを新規判定に使わない。既存DBでは作成時刻と初回取得時刻が一致しないケースがあるため、対象時間帯に**初めてPriceHistoryを持ったProduct**を新規カードとして扱える削除コマンドを用意する。

今後、拡張機能の未登録探索で回帰が出た場合は、現行コードだけでなくPR #20前後の `background.js` / Service Worker chain / 検索URL変更履歴も確認すること。また「新規登録された」と判断する前に `Product.createdAt` と `PriceHistory.checkedAt` を分けて確認する。

## 実装

- `lib/product-title-condition.ts`
  - タイトル末尾だけでなく、トップレベル括弧を走査して状態表記を検出する。
  - 状態括弧より後ろの機種・edition表記は保持する。
- `browser-extension/new-product-discovery-policy.js`
  - `isConditionVariantTitle()` を提供する。
- `browser-extension/auto-add-condition-filter-wrapper.js`
  - 検索結果ページ上の同一商品URLに対するリンク文字列・title・aria-label・画像altから最も情報量の多いタイトル候補を集める。
  - 明確な状態違いタイトルのURLを `readSearchPage()` の `productUrls` から除外する。
- `browser-extension/service-worker.js`
  - `fast-site-mode-wrapper.js` がbackground本体を読み込んだ後に状態違いフィルタを読み込む。

検索一覧に状態情報が一切出ていない商品は一覧段階では判定できない。その場合でも、保存後の状態判定やシリーズ集計では `splitProductTitleCondition()` の結果を使用すること。

## 既存データの削除

### 状態違いで重複したカードを消す

通常状態の商品と、状態表記を除いたタイトルが同一のランクB/欠品/状態難Productだけを削除する。

まず確認のみ:

`npm run cleanup:condition-duplicates`

確認した対象を削除:

`npm run cleanup:condition-duplicates -- --apply`

`lib/condition-duplicate-products.ts` で状態表記を除いた商品タイトルをNFKC正規化し、空白・句読点を無視して同一editionを照合する。通常状態の商品が存在しない状態違いProductは自動削除しない。通常版・廉価版・対応OS版など、タイトル本体が異なる状態A商品も削除しない。

削除はProduct IDを400件ずつに分割し、SQLiteのパラメータ上限を避ける。Product配下の `PriceHistory` / `PriceChange` / `JunkHistory` は既存のCASCADE設定に従って削除される。

### 画面上でその時間帯に初めて現れたカードをまとめて消す

`Product.createdAt` が実際の初回取得時刻と一致しない既存データがあるため、今回のように「17:59頃の処理で新しく見えるようになったカードを全部消したい」場合はこちらを使う。

確認のみ:

`npm run cleanup:first-seen-products -- --from=<ISO日時> --to=<ISO日時>`

削除:

`npm run cleanup:first-seen-products -- --from=<ISO日時> --to=<ISO日時> --apply`

対象条件は以下の両方。

1. 指定範囲内の `PriceHistory.checkedAt` が1件以上ある。
2. 範囲開始より前の `PriceHistory` が1件もない。

つまり状態・タイトルに関係なく、その時間帯に初めて価格履歴を持ったProductカードを全削除する。既存商品がたまたま同時刻に通常巡回されただけなら、過去履歴があるため対象外になる。

### Product.createdAtで削除する

`Product` には過去のimport元が「手動」「自動追加」のどちらだったかを永続化するフィールドがない。そのため過去の自動追加だけを後から完全には識別できない。

指定した `Product.createdAt` 範囲で削除する旧コマンドも残す。

`npm run cleanup:created-products -- --from=<ISO日時> --to=<ISO日時> --apply`

`--apply` を外すと削除対象の確認のみを行う。`createdAt` が実際の新規カード発生時刻と一致しないケースでは `cleanup:first-seen-products` を優先する。
