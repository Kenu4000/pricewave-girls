# Pricewave / pricewave-girls 引き継ぎ資料

最終確認: 2026-09-04
確認対象: `main`
確認時HEAD: `2287cde2fa29138541b4d9f6ad46b4837cf2bc08` (`Viewerホームの最終script判定を修正する`)

この文書は、別チャット・別担当・時間を空けた再開時に、`pricewave-girls` の現状を短時間で復元するための引き継ぎ資料である。

## 0. 次に引き継ぐ人が最初に行うこと

1. この文書を読む。
2. `main` のHEADと、この文書の「確認時HEAD」を比較する。
3. HEADが進んでいれば、直近コミットとPRを確認して、この文書より新しい仕様を優先する。
4. Open Issueがあれば未処理事項として確認する。
5. 大きな仕様・構成・運用変更を行った場合は、この文書も更新する。

**正本は常に現在の `main` のコードであり、この文書はその理解を補助するもの。**

---

## 1. このプロジェクトは何か

駿河屋の商品、とくにPCゲーム系を中心に、販売価格・買取価格・在庫・商品状態・タイムセール・他店舗価格などを継続取得し、履歴として保存・閲覧する個人用価格トラッカー。

現在は単純な「価格保存Webアプリ」ではなく、次の3層で構成されている。

```text
駿河屋
  ↓ Edge拡張で通常のブラウザ閲覧を利用して取得
ローカルPC
  ├─ Next.js UI / API
  ├─ Prisma + SQLite（データの正本）
  └─ Edge拡張による巡回・新規商品追加
          ↓ 巡回完了
     Viewerスナップショット生成
          ↓
GitHub Pages (`gh-pages`)
  └─ スマホ・別PC向け閲覧専用Viewer
```

### 重要な前提

- **価格データの正本はメインPC上のSQLite。**
- GitHub PagesにはDBそのものを置かず、閲覧用に書き出した静的スナップショットだけを公開する。
- 駿河屋のアクセス確認を回避する機能は作らない。アクセス確認を検出した場合は巡回を停止する。
- Viewerは現在、閲覧専用として扱う。

---

## 2. 技術構成

- Next.js 16
- React 19
- TypeScript
- Prisma 6
- SQLite
- Recharts
- Cheerio
- Playwright
- Edge Manifest V3拡張
- 静的Viewer: HTML / CSS / Vanilla JavaScript
- GitHub Pages: `gh-pages`

Nodeは `package.json` 上 `>=20.9.0`。CIはNode 22を使用する。

主要コマンド:

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run viewer:export
npm run viewer:publish
```

ローカルDBは `prisma/dev.db`。Git管理しない。

---

## 3. データモデル

`prisma/schema.prisma` が正本。

### Product

商品そのものと最新状態を保持する。

主な項目:

- `title`
- `surugayaUrl`（unique）
- `imageUrl`
- `managementNumber`
- `manufacturer`
- `releaseDate`
- `listPrice`
- `modelNumber`
- `category`
- `detailsJson`
- `latestSalePrice`
- `latestRegularSalePrice`
- `latestBuyPrice`
- `salePriceChangedAt`
- `buyPriceChangedAt`
- `stockStatus`
- `condition`
- `conditionRank` (`A` / `B`)
- `crawlIntervalDays` (`1 / 3 / 7 / 14 / null`)
- `crawlIntervalReviewedAt`
- `isTimeSale`
- `previousIsTimeSale`
- `timeSaleStartedAt`
- `timeSaleEndsAt`

### PriceHistory

各巡回時点の販売・買取・在庫・状態・タイムセール状態を保存する。

### PriceChange

販売価格または買取価格が変化したイベントを保存する。

### JunkHistory

- 状態違い商品
- 他ショップ商品

の価格履歴を保存する。`sourceType`, `storeName`, `condition`, `price` を持つ。

---

## 4. ローカルNext.js側

ローカル版はSQLiteへ直接アクセスできる管理・閲覧画面。

### 主なページ

- `/products` — 商品一覧
- `/products/[id]` — 商品詳細
- `/changes` — 価格変更
- `/history` — 閲覧履歴
- `/requests` — GitHubのOpen Issue表示
- `/crawl-review` — 巡回周期振り分け
- `/automation/run` — 日次自動巡回開始用ページ

ヘッダーには現在、価格変更・履歴・リクエスト・周期振り分けがある。

### 商品一覧

現在の検索・絞り込みは単純な商品名だけではない。

商品名に加え、ブランドや商品詳細メタデータを横断する検索が実装されている。また、以下のような個別フィルタを持つ。

- ブランド
- 発売年度
- 原画
- シナリオ
- 声優
- OS
- 商品詳細の任意ラベル/値
- 巡回周期
- 状態表記付き商品の除外
- 各種価格・履歴系ソート

### 商品詳細

商品詳細では以下を表示する。

- 商品画像
- 販売価格
- 通常価格
- 買取価格
- 在庫
- 商品状態 / ランクB
- タイムセール
- 価格推移グラフ
- 巡回周期
- 駿河屋の商品詳細情報
- 他ショップ / 状態違い価格
- 価格履歴

「駿河屋の商品詳細情報」の値は検索導線になっている。

例:

- メーカー / ブランド → ブランド絞り込み
- 原画 / 原画家 → 原画家絞り込み
- シナリオ / 脚本 → シナリオ絞り込み
- 声優 / キャスト → 人物ごとに分離して声優絞り込み
- 発売日 → 発売年度
- OS / 対応機種 → OS
- その他 → `detailLabel + detailValue`

つまり、商品詳細の各メタデータから「同じ属性を持つ商品一覧」へ回遊できることが設計上重要。

---

## 5. 価格変更

`/changes` ではPriceChangeを50件単位で表示する。

主なフィルタ:

- 商品名
- ブランド
- 販売 / 買取
- 値上げ / 値下がり

表示上は、

- 値上げ `↑`
- 値下がり `↓`
- ランクB商品は薄緑背景

として視認性を上げている。

小さい価格変更の一括削除、個別PriceChange削除もローカル側には存在する。

---

## 6. 巡回周期

各商品は次のどれかを持つ。

- `1` = 毎日
- `3` = 3日周期
- `7` = 7日周期
- `14` = 14日周期
- `null` = 巡回しない（UIでは「無」）

### 現在の選定ルール

`browser-extension/balanced-crawl-scheduler.js` が中心。

- 1日商品は毎回すべて巡回する。
- 3 / 7 / 14日商品は42日を共通周期として、日ごとの理論件数が均等になるよう選定する。
- `null` は巡回対象外。
- `lastCheckedAt` は「対象にするか」の条件には使わない。
- 長周期商品の中で、より遅れている商品を優先するためにだけ `lastCheckedAt` を使う。
- 「最低でも1件は回す」というフォールバックはない。少数の14日商品を毎日取得することを防ぐ。
- 手動の「今すぐ巡回」も自動巡回と同じ周期ロジックを使う。

### 周期振り分け

ローカル版には1日設定の商品を順番に見て、

- 1日のまま
- 3日
- 7日
- 14日
- 無

へ分類する画面がある。

`crawlIntervalReviewedAt` は「1日のままで確認済み」の商品を何度も候補へ出さないために使う。周期を変更すると確認済み状態は解除される。

ブランド単位の一括周期変更もある。

`npm run crawl:set-after-flatz-7` は、ブランド別名統合後の五十音/ロケール順で `FLATZ` より後ろのブランドの商品を7日周期へ設定するための専用スクリプト。

---

## 7. ブランド正規化

DBの元値を一律に書き換えるのではなく、表示・検索・絞り込み上で別名をまとめる仕組みを持つ。

確認済みの代表例:

- Littlewitch系
- feng系
- F&C系
- AQUAPLUS / Leaf系のViewer表記調整

このため、ブランド関連を変更する場合は `lib/brand-aliases.ts` やViewer側のブランド補正も確認すること。

ブランド候補UIは直近でも変更が多い。現在のViewerではmain側と同じ構成へ揃える作業が進んでおり、「製品数順」と五十音側の扱い、キャッシュキー、冪等なDOM補正がテスト対象になっている。

---

## 8. Edge拡張

`browser-extension/` が駿河屋取得の実体。

主な役割:

- 現在開いている商品を記録
- 登録商品の巡回
- 検索結果から未登録商品を追加
- 他ショップ一覧の取得
- 状態違い商品の取得
- タイムセール情報の取得
- 自動巡回
- ローカルAPIへの一括送信

### 取得時の基本方針

- 通常のEdgeで閲覧できるページを使う。
- アクセス確認の自動突破はしない。
- Cloudflare等のアクセス確認を検出したら停止する。
- 一時的なEdgeの `Tabs cannot be edited right now` はブラウザ側の一時ロックとして短時間リトライする。
- 商品と他ショップ情報を一体として扱う箇所では、他ショップ取得に失敗した場合に商品だけ不完全保存しない。

拡張機能ファイルを変更した場合、Edgeの拡張機能画面で再読み込みが必要になる場合がある。

---

## 9. 他ショップ / 駿河屋UI再現

他ショップ一覧は単なる価格テーブルだけではなく、取得時のHTMLスナップショットを保存し、ローカル版・Viewerで駿河屋風UIとして再現する仕組みがある。

PC版とモバイル版の他ショップ表示を別々に保存・切替する実装も入っている。

重要な設計方針:

- 表示はローカル/Viewerで再現してよい。
- **購入、カート、配送、返品など「駿河屋側で実際に操作するもの」はローカルで偽実装しない。**
- その種の操作要素は別タブで駿河屋本体へ送る。
- 操作ごとの細かい画面遷移まで再現する必要はなく、その商品の駿河屋本体へ誘導できればよい。

`.pricewave-snapshots/` はGit管理外。

---

## 10. GitHub Pages Viewer

`viewer/` がソース。`viewer-dist/` が生成物でGit管理外。公開結果は `gh-pages` へ置く。

### 現在の位置づけ

Viewerは**閲覧専用**。

現在の `viewer/index.html` では:

- ブランドロゴ/タイトルの遷移先は `#/changes`
- 主ナビは「価格変更」「履歴」
- フッターにも「閲覧専用 GitHub Pages」と表示

となっている。

以前、一時的にViewerから巡回周期変更をGitHub Issueで依頼する仕組みが存在したが、現行コードではそのIssue作成導線は残っていない。古いPR説明を現行仕様と誤認しないこと。

### Viewerの主要機能

- 価格変更をホームとして表示
- 商品一覧・商品詳細への遷移
- 商品検索
- ブランド・各種商品詳細フィルタ
- 価格履歴
- 価格推移グラフ
- ジャンク / 他ショップ表示
- タイムセール表示
- 巡回周期の表示
- モバイルUI

### Viewer実装上の最大の注意点

Viewerは現在、`app.js` の基本描画に対して多数の後付けJS/CSSがDOMを補正する構成になっている。

例:

- `changes-main-ui.js`
- `mobile-search.js`
- `brand-featured-options.js`
- `crawl-interval-filter.js`
- `detail-filter-links.js`
- `product-detail-enhancements.js`
- `other-shop-embed.js`
- `surugaya-faux-ui.js`
- `leaf-brand-normalization.js`
- `home-ui.js`

これらはMutationObserverや既存DOMの後処理を使うものが多い。

**scriptの読み込み順・同じ処理を複数回走らせても壊れないこと（冪等性）・`?v=...` のキャッシュキーが重要。**

2026-09-04時点の最新コミットも、`home-ui.js` が最終scriptになることを保証する回帰テストの修正である。

Viewer周辺を変更するときは、見た目だけでなく既存のViewer回帰テストを必ず確認する。

---

## 11. Viewer公開

手動公開:

```bash
npm run viewer:publish
```

または:

```text
publish-viewer.cmd
```

概念上の処理:

1. SQLiteから商品・PriceChange・PriceHistory・JunkHistory等を読む。
2. `viewer-dist/` にHTML/CSS/JS/JSONを書き出す。
3. 一時Gitリポジトリを作る。
4. `gh-pages` を最新スナップショットへ更新する。
5. GitHub Pagesから配信する。

`viewer-dist/` をmainへコミットしない。

### 公開範囲

リポジトリはpublic。

Viewerへ書き出した商品名・価格・履歴等は公開情報になる。SQLite本体、ブラウザ状態、ローカル設定は公開しない。

---

## 12. 日次自動運用

2026-09-03に、巡回開始からViewer公開までを一本化する仕組みが追加された。

### 流れ

```text
Windows タスクスケジューラ
  ↓
scripts/start-pricewave-daily.ps1
  ↓
必要なら npm run dev を起動
  ↓
Edgeで /automation/run?run=... を開く
  ↓
Edge拡張が巡回
  ↓
巡回完了
  ↓
POST /api/automation/publish-viewer
  ↓
npm run viewer:publish
  ↓
gh-pages更新
```

### タスク登録

`scripts/install-pricewave-scheduled-task.ps1`

既定:

- タスク名: `Pricewave Daily Update`
- 時刻: 09:00
- `WakeToRun`
- 開始可能になったら実行
- 多重起動は `IgnoreNew`
- 最大12時間

Edge拡張を使うため、Interactiveなサインイン済みユーザーセッションで動かす。

したがって:

- PCをシャットダウンしていると動かない。
- ログオフ状態のSession 0ではブラウザ拡張を使わない。
- サインインしたままスリープ/休止する運用を想定する。

Viewer公開API側は同時公開を拒否し、二重publishを防いでいる。

---

## 13. Git管理しないもの

`.gitignore` 上、少なくとも次をGitへ入れない。

- `node_modules/`
- `.next/`
- `viewer-dist/`
- `prisma/dev.db`
- `prisma/dev.db-journal`
- `.pricewave-browser/`
- `.pricewave-snapshots/`
- `*.log`

価格データの正本を誤ってGitへ追加しないこと。

---

## 14. テスト / CI

CIはPRと`main`へのpushで実行される。

Node 22環境で:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

を行う。

テストは `lib/*.test.ts` に大量にあり、単なるユニットテストだけでなく、Viewerのscript順序、HTML構造、キャッシュキー、DOM補正、拡張機能の読み込み関係まで回帰テストとして固定している。

**特にViewerはテストが仕様書の役割も持っている。**

---

## 15. 過去に発生した重要な落とし穴

### SQLiteのパラメータ上限

商品数増加により、「除外対象IDを大量の `NOT IN (...)` にする」実装がSQLite/Prismaのパラメータ上限へ到達したことがある。

PR #88で、状態表記付き商品の除外を巨大な否定条件ではなく、通常商品のIDを `IN (...)` する方式へ変更している。

大量IDをPrisma条件へ入れる処理では、特に否定条件の巨大配列を避けること。

### Viewerのキャッシュ

静的GitHub Pagesなので、JS/CSS変更時に古いキャッシュが残る問題がある。そのため `?v=...` を使っている。

Viewerファイルを変更したのに公開環境で反映されない場合、まずキャッシュキーと `viewer/index.html` の参照を確認する。

### Viewerの後付け補正

同じ画面へ複数scriptが触るため、

- 読込順
- MutationObserver
- 冪等性
- 再描画後にも補正が維持されるか

を壊しやすい。

### ドキュメントの古さ

- ルート `README.md` は主に2026-08-04時点。
- `GITHUB_PAGES.md` は主に2026-08-08時点。
- `browser-extension/README.md` も主に2026-08-04時点。

これらは背景理解には有用だが、細部には現在と違う記述がある。

例:

- 拡張の未登録商品追加上限1000件は後に撤廃されている。
- Viewerはその後大きくUI・導線が変わった。
- 日次巡回→Viewer公開の自動化は9月に追加された。

**現行仕様判定はこの文書だけでもなく、必ず最新mainを優先すること。**

---

## 16. 2026-09-04時点の最近の開発方向

直近は特にViewer側の改善が集中している。

主な流れ:

- Viewer価格変更を中心画面にする。
- 注目対象 / 全商品など価格変更の見せ方を整理する。
- Viewerモバイルホームをmain側の構成へ寄せる。
- ブランド一覧・メーカー候補をmain側と揃える。
- AQUAPLUS / Leaf等の表記正規化をViewerへ反映する。
- キャッシュキーを更新する。
- 後付けscriptの冪等性・読込順を回帰テストで固定する。
- 日次巡回からViewer公開までを自動化する。

2026-09-04確認時点でOpen Issueは0件。

「未完了タスクが0」という意味ではなく、Issueに明示された未処理項目がないという意味。新しい作業指示が来た場合は、最新コミットと現在のコードを基準に続ける。

---

## 17. 実装時に維持したい設計意図

1. **SQLiteがデータの正本。** Viewerを正本にしない。
2. **駿河屋のアクセス確認を突破しない。** 通常ブラウザ利用の範囲で取得する。
3. **Viewerは閲覧専用。** ローカルDB操作を静的サイトへ無理に持ち込まない。
4. **商品詳細のメタデータは回遊導線にする。** 同属性商品へ絞り込めることを維持する。
5. **駿河屋で行う実操作は駿河屋本体へ送る。** 偽カート等を作らない。
6. **他ショップ表示は取得時スナップショットを再現する。** PC/モバイル差も考慮する。
7. **巡回負荷を周期で分散する。** 全商品を毎日無条件取得する設計へ戻さない。
8. **Viewerのscript順・キャッシュ・冪等性を軽視しない。** 現状もっとも壊れやすい箇所の一つ。
9. **大量商品を前提にSQLite/Prismaの変数上限を考える。** 巨大`NOT IN`等を避ける。
10. **変更時は回帰テストを追加/更新する。** このリポジトリでは細かなUI仕様もテストで固定している。

---

## 18. 次回の引き継ぎでこの文書を更新する条件

次のいずれかが起きたら、この文書を更新する。

- DBモデルを変更した。
- 取得方式を変更した。
- 巡回周期の計算を変更した。
- Viewerの役割（閲覧専用/操作可能）を変更した。
- GitHub Pages公開方式を変更した。
- 日次自動運用を変更した。
- 大きな画面構成を変更した。
- 重要な設計判断や「やらないこと」が変わった。
- 重大な障害と恒久対策が入った。

更新時は冒頭の「最終確認」「確認時HEAD」も更新する。
