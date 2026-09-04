# Pricewave / pricewave-girls 引き継ぎ資料

最終更新: 2026-09-04  
対象: `Kenu4000/pricewave-girls` / `main`  
今回の実装基準: merge commit `93e8c760e6fcc53ec999a0ce13ff565333b05202`（PR #89）

この文書は、別チャット・別担当・時間を空けた再開時に `pricewave-girls` の現状を短時間で復元するための引き継ぎ資料である。

## 0. 次回の引き継ぎで最初に確認すること

1. この文書を読む。
2. 現在の `main` HEAD を確認する。
3. この文書の実装基準よりHEADが進んでいれば、直近コミット・PRを確認する。
4. Open Issueを確認する。
5. 実装と文書が食い違う場合は、**現在の `main` のコードを正本とする**。
6. 大きな仕様・運用・データモデル変更を行ったら、この文書も更新する。

README類は初期仕様の説明が残っている箇所があるため、引き継ぎ時はREADMEだけで現行仕様を判断しない。

---

## 1. このプロジェクトは何か

駿河屋の商品、とくにPCゲーム系を中心に、販売価格・買取価格・在庫・商品状態・タイムセール・他店舗価格を継続取得し、履歴として保存・閲覧する個人用価格トラッカー。

現在は大きく3層に分かれている。

```text
駿河屋
  ↓
Edge拡張
  ├─ 商品ページ取得
  ├─ 他店舗情報取得
  ├─ 未登録商品の探索・追加
  └─ 登録商品の周期巡回
  ↓
ローカルPC
  ├─ Next.js UI / API
  ├─ Prisma
  └─ SQLite ← データの正本
  ↓ 巡回後にスナップショット生成
GitHub Pages / gh-pages
  └─ スマホ・別PC向け静的Viewer
```

### 重要な前提

- 価格データの正本はメインPC上のSQLite。
- `prisma/dev.db` はGitHubへ上げない。
- GitHub Pagesには閲覧用の静的スナップショットだけを出す。
- 駿河屋のアクセス確認を回避する機能は作らない。
- アクセス確認を検出した場合は巡回を停止する。
- Viewerは閲覧専用として扱う。
- 駿河屋上で実際に行う購入・カート・配送・返品等の操作をローカル/Viewer側で偽実装しない。必要な操作は駿河屋本体を別タブで開く。

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
- Viewer: HTML / CSS / Vanilla JavaScript
- GitHub Pages: `gh-pages`

Nodeは `package.json` 上 `>=20.9.0`。CIはNode 22。

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

`npm run dev` 前の `predev` で `prisma migrate deploy` と `prisma generate`、既存データ補完スクリプトが実行される。

---

## 3. データモデル

主要モデル:

- `Product`
- `PriceHistory`
- `PriceChange`
- `JunkHistory`
- `CrawlRun`

### Product

商品単位の現在値・基本情報を保持する。

主な情報:

- 駿河屋URL
- 商品名
- 画像URL
- 管理番号
- メーカー/ブランド
- 発売日
- 定価
- 型番
- カテゴリ
- `detailsJson`
- 最新販売価格
- 通常販売価格
- 最新買取価格
- 在庫
- 商品状態 / `conditionRank`
- 巡回周期 `crawlIntervalDays`
- 周期確認済み日時 `crawlIntervalReviewedAt`
- タイムセール状態・開始/終了

巡回周期は `1 / 3 / 7 / 14 / null`。`null` は「無」、つまり巡回対象外。

### PriceHistory

各取得時点の販売価格、通常価格、買取価格、在庫、商品状態、タイムセール状態を保存する。

### PriceChange

販売・買取価格の変化イベントを保存する。価格変更一覧では値上げ/値下がり方向を表示し、ランクB商品も識別する。

### JunkHistory

「その他の状態を選ぶ」や他ショップの状態・価格を通常商品価格と分離して保存する。

### CrawlRun

2026-09-04追加。**登録商品の巡回1回そのもの**を記録する。

保存する情報:

- 起動元 `trigger`
- 状態 `running / completed / blocked / cancelled / error`
- 対象件数
- 成功件数
- 失敗件数
- メッセージ/停止理由
- 開始日時
- 終了日時
- Viewer公開状態 `success / error`
- Viewer公開日時
- Viewer公開メッセージ

対象は登録商品の巡回。単品の手動取込と未登録商品の自動追加は、現時点では `CrawlRun` の対象外。

---

## 4. ローカルNext.js側

主要画面:

- `/products` 商品一覧
- `/products/[id]` 商品詳細
- `/changes` 価格変更
- `/history` 閲覧履歴
- `/requests` GitHub Open Issue表示
- `/crawl-review` 巡回周期振り分け
- `/crawl-runs` 巡回実行履歴
- `/automation/run` 日次自動実行用画面

### 商品一覧

商品名だけでなくブランド・商品詳細メタデータまで横断検索する。ブランド、OS、原画、シナリオ、声優、発売年度、価格、在庫、商品状態、巡回周期などで絞り込む。

過去にSQLite/Prismaのパラメータ上限事故があったため、大量IDを `NOT IN (...)` に入れる実装は避ける。PR #88で状態表記商品の除外を「除外IDのNOT IN」から「通常商品のID IN」へ変更して修正した。

### 商品詳細

- 現在の販売/買取価格
- 在庫
- 商品状態
- タイムセール
- 価格推移
- 価格履歴
- 他店舗/状態違い履歴
- 巡回周期変更
- 駿河屋の商品詳細情報

を表示する。

「駿河屋の商品詳細情報」の値は検索導線になっている。

- メーカー/ブランド → ブランド絞り込み
- 原画/原画家 → 原画絞り込み
- シナリオ/脚本 → シナリオ絞り込み
- 声優/キャスト → 声優絞り込み
- OS/対応機種 → OS絞り込み
- 発売日 → 発売年度絞り込み
- その他の詳細項目 → `detailLabel` + `detailValue` 絞り込み

人物が複数いる場合は個別リンクに分割する。

### 巡回履歴 `/crawl-runs`

直近100回の登録商品巡回を表示する。

表示項目:

- 開始日時
- 起動元
- 状態
- 対象件数
- 成功
- 失敗
- 所要時間
- Viewer公開結果
- メッセージ

今後、日次運用の正常性を見るときは商品単位の最終更新日時だけでなく、この画面も確認する。

---

## 5. Edge拡張

`browser-extension/` が取得処理の中心。

主な責務:

- 表示中の商品を手動取込
- 登録商品を周期巡回
- 検索結果から未登録商品を追加
- 商品ページHTML解析
- 他ショップ情報取得
- アクセス確認検出
- 並列タブ制御
- Edgeの一時的なタブAPIエラー再試行
- 巡回状態保存
- 巡回実行履歴の記録

### アクセス確認

Cloudflare等のアクセス確認を検出した場合、回避しない。処理を停止し `blocked` とする。

### 巡回周期

登録商品は `1 / 3 / 7 / 14 / 無` に分類する。

- 1日: 毎回対象
- 3/7/14日: 42日サイクルで日次件数を均等化
- 無: 対象外

長周期商品の `lastCheckedAt` は「対象から外す条件」ではなく、同じ日の候補内で古い商品を優先するために使う。

手動の「今すぐ巡回」も自動巡回と同じ周期計算を使う。

### CrawlRun記録

`crawl-run-history-wrapper.js` が登録商品の `runAllProducts()` を包む。

処理:

1. 拡張機能状態を先に `running` にする。
2. `POST /api/crawl-runs` で実行レコードを作る。
3. 返った `crawlRunId` を拡張機能状態へ保持する。
4. 通常の巡回を実行する。
5. 完了/停止時に現在の件数・状態を `PATCH /api/crawl-runs/[id]` へ保存する。

履歴APIへの保存失敗だけで巡回本体を止めない。履歴は監視用であり、取得本体より優先しない。

また、履歴作成前に `running` へ切り替えるのは重要。前回の `completed` 状態を `/automation/run` が新しい巡回の完了と誤認する競合を防いでいる。

拡張機能のファイルを更新した場合はEdgeの拡張機能画面で再読み込みする必要がある。

---

## 6. 他ショップ表示

他ショップ一覧は単純なテキスト一覧だけでなく、取得時HTMLスナップショットを保存してViewer/ローカルで駿河屋風UIとして再現する仕組みがある。

- PC版とモバイル版の表示を分けて保存/表示する実装がある。
- スナップショット本体は `.pricewave-snapshots/` に置きGit管理しない。
- UIは見た目を再現しても、カート等の実操作を再現しない。
- 操作系リンクは駿河屋本体へ誘導する。

この領域は過去に「実iframe」から「保存HTML」「偽iframe風UI」へ何度か設計が変わっているため、変更時は8月12〜14日前後のコミットも確認する。

---

## 7. GitHub Pages Viewer

`viewer/` がソース。`scripts/export-viewer-data.ts` がSQLiteから閲覧用データを書き出し、`scripts/publish-viewer.mjs` が `gh-pages` を更新する。

Viewerは現在**閲覧専用**。過去にGitHub Issue経由で巡回周期変更を依頼するUIが存在したが、現行仕様では商品詳細の巡回周期は表示中心で、ViewerからDBを直接変更しない。

現在のホームは `#/changes`、つまり価格変更中心。

主ナビ:

- 価格変更
- 履歴

商品検索・商品詳細への遷移はViewer内で可能。

### Viewerの技術的注意点

Viewerは長期間、`app.js` が描画したDOMを複数の後付けスクリプトが `MutationObserver` で監視・修正する構造になっていた。

この方式では以下が事故要因になった。

- script読込順
- DOM再描画のタイミング
- 同じ補正の二重適用
- MutationObserver同士の連鎖
- `?v=...` キャッシュキー更新漏れ
- `home-ui.js` より後にscriptを追加してしまうこと

### enhancement-runtime

2026-09-04、PR #89で `viewer/enhancement-runtime.js` を追加した。

目的はViewerを一気に全面書き換えず、後付け補正を段階的に共通ランタイムへ集約すること。

現在共通ランタイムへ移行済み:

- `brand-featured-options.js`
- `crawl-interval-display.js`
- `product-detail-enhancements.js`

共通ランタイムが:

- `#app` に対する1つのMutationObserver
- `requestAnimationFrame`による実行集約
- named enhancement登録
- enhancement単位の例外分離
- hashchange時の再実行
- 再実行要求のまとめ上げ

を担当する。

**これでViewerの後付けJS問題が完全解消したわけではない。** 他にも後付けスクリプトは残っている。今後Viewerを触る際は、個別に新しい `MutationObserver` を増やすより、まず `PricewaveViewerEnhancements.register(...)` へ載せられないか検討する。

### script順の重要ルール

`home-ui.js` は現状、最後のscriptであることを回帰テストしている。

`viewer/index.html` にscriptを追加する場合、無意識に `home-ui.js` の後ろへ置かない。

---

## 8. Viewer公開

`npm run viewer:publish` の流れ:

1. SQLiteから商品・価格変更・価格履歴・ジャンク履歴等を読み出す。
2. `viewer-dist` にHTML/CSS/JS/JSONを書き出す。
3. 一時Gitリポジトリを作る。
4. `gh-pages` を最新スナップショットでforce更新する。
5. GitHub Pagesから閲覧する。

`main` に日々の価格データをコミットしない。

日次自動化からViewer公開した場合は、`crawlRunId` を `/api/automation/publish-viewer` へ渡し、その巡回の `CrawlRun` に公開成功/失敗を関連付ける。

手動で単独実行した `npm run viewer:publish` は特定の `CrawlRun` へは紐付かない。

---

## 9. Windows日次自動運用

現在はWindowsタスクスケジューラから巡回〜Viewer公開まで自動化できる。

主なファイル:

- `scripts/install-pricewave-scheduled-task.ps1`
- `scripts/start-pricewave-daily.ps1`
- `app/automation/run/page.tsx`
- `browser-extension/automation-runner.js`
- `app/api/automation/publish-viewer/route.ts`

流れ:

```text
Windows Scheduled Task
  ↓
start-pricewave-daily.ps1
  ↓
必要なら Next.js dev server 起動
  ↓
Edgeで /automation/run を開く
  ↓
拡張機能が登録商品巡回
  ↓
CrawlRunを完了状態へ更新
  ↓
Viewer生成 / gh-pages公開
  ↓
CrawlRunへViewer公開結果を記録
```

タスクはEdge拡張を使うため、ユーザーの対話セッションで動く。PCを完全シャットダウンした状態では動かない。スリープ/休止からのWakeToRunを想定している。

---

## 10. ブランド処理

ブランドは保存済み生データを無理に一括書換えせず、表示・検索・集計側で別名統合する設計を使う。

既存例:

- ALICESOFT
- 戯画 / GIGA
- FrontWing
- NitroPlus
- Purple software
- Leaf / AQUAPLUS
- あかべぇそふとつぅ / AKABEi SOFT2 / AiNO
- F&C系列
- Littlewitch系列
- feng

Viewerとmainでブランド候補の区分・別名統合がずれないよう回帰テストがある。

---

## 11. テストとCI

CI:

```text
npm ci
npm test
npm run typecheck
npm run build
```

PR #89の最終HEAD `da5897681e391dff19cd9f3002e96da223f584aa` では4工程すべて成功済み。

Viewerの変更では見た目だけでなく、以下のような構造をテストで固定している。

- script順
- キャッシュキー
- JavaScript構文
- ブランド候補構成
- 商品詳細リンク
- Viewer補正ランタイム
- 個別MutationObserverが再増殖しないこと

Viewerを触る際は既存テストを削って通すのではなく、意図が変わった場合だけ新仕様へ更新する。

---

## 12. 過去に踏んだ重要な問題

### SQLite変数上限

商品数増加に伴い、状態表記商品の大量IDを `NOT IN (...)` へ渡した結果、Prisma/SQLiteのクエリパラメータ上限を超えた。

教訓:

- 大量IDの否定条件を作らない。
- 可能なら肯定条件側を抽出する。
- 大量更新は適切な件数に分割する。

### Viewerの後付けJS

同じDOMへ複数Observerが別々に補正を掛け、読込順・二重適用・キャッシュ更新で壊れやすかった。

教訓:

- 新規Observerを安易に増やさない。
- 共通ランタイムへ寄せる。
- `home-ui.js` の最終script制約を守る。
- JS/CSS変更時はキャッシュキーも確認する。

### 巡回周期ロジックの上書き

wrapperの読込順により、新しい `selectScheduledProducts` 差し替えが古い `crawl-policy.js` 再読込で失われたことがある。

教訓:

- Service Workerの `importScripts` / wrapper順は仕様の一部。
- グローバルオブジェクト再生成を避け、必要なら冪等化する。

---

## 13. 現時点の設計判断として維持するもの

- 個人利用前提。不要なアカウント管理を増やさない。
- SQLiteをローカル正本とする。
- GitHub Pagesは閲覧用スナップショット。
- アクセス確認を回避しない。
- 買い物操作は駿河屋本体へ送る。
- 商品詳細のメタデータは検索導線として使う。
- ブランドの生データを無理に統一せず別名解決層を使う。
- 巡回周期は全件毎日ではなく重要度に応じて分散する。
- Viewerに新しい個別Observerを増やす前に共通ランタイムを使う。
- 巡回本体は履歴保存失敗に巻き込まない。
- 大量IDの `NOT IN` を避ける。

---

## 14. 現時点で残っている技術的負債・次の候補

### Viewer後付け処理の残り

PR #89は第一段階。共通ランタイムへ移していないViewer補正がまだある。

今後は機能変更のついでに、単純なDOM監視処理から順に `enhancement-runtime` へ寄せる。全面リライトを先に行う必要はない。

### CrawlRunの活用

履歴を保存できるようになったので、次の発展候補は:

- 予定周期を超えて更新されていない商品の検出
- 直近N回の成功率
- blocked/errorの連続検出
- 日別所要時間
- Viewer公開失敗の強調

ただし、まず実運用で数日分の `CrawlRun` を蓄積し、必要な指標を確認してからUIを増やす方がよい。

---

## 15. Git管理しないローカルデータ

`.gitignore`対象の代表:

- `prisma/dev.db`
- `prisma/dev.db-journal`
- `.pricewave-browser/`
- `.pricewave-snapshots/`
- `viewer-dist/`
- `.next/`
- `node_modules/`

これらを引き継ぎ目的でGitHubへ追加しない。

---

## 16. 次回作業開始時の実務手順

```text
1. docs/PROJECT_HANDOFF.mdを読む
2. main HEADを確認
3. 直近コミット/PRを確認
4. Open Issueを確認
5. 変更対象ファイルの現行コードを読む
6. 関連テストを読む
7. 実装
8. npm test / typecheck / build相当を確認
9. PRをマージ
10. 大きな変更ならこの文書を更新
```

チャット上の過去説明よりGitHubの現在コードを優先する。
