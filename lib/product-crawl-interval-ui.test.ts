import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("商品一覧に1・3・7・14日・無の巡回周期ボタンを表示する", async () => {
  const grid = await readFile(new URL("../components/ProductGrid.tsx", import.meta.url), "utf8");
  assert.match(grid, /1日/u);
  assert.match(grid, /3日/u);
  assert.match(grid, /7日/u);
  assert.match(grid, /14日/u);
  assert.match(grid, /label: "無"/u);
  assert.match(grid, /aria-pressed/u);
  assert.match(grid, /crawl-interval/u);
});

test("自動巡回と手動巡回は同じ均等化スケジュールを使う", async () => {
  const wrapper = await readFile(
    new URL("../browser-extension/popular-refresh-wrapper.js", import.meta.url),
    "utf8",
  );
  const scheduler = await readFile(
    new URL("../browser-extension/balanced-crawl-scheduler.js", import.meta.url),
    "utf8",
  );

  assert.match(wrapper, /balanced-crawl-scheduler\.js/u);
  assert.match(wrapper, /balancedScheduler\.selectBalancedProducts\(source, value\)/u);
  assert.match(wrapper, /const plan = selectAutomaticProducts\(source, value\)/u);
  assert.doesNotMatch(wrapper, /manualFullRun/u);
  assert.doesNotMatch(wrapper, /products: enabledProducts/u);
  assert.match(scheduler, /BALANCE_CYCLE_DAYS = 42/u);
  assert.match(scheduler, /BALANCED_INTERVALS = new Set\(\[3, 7, 14\]\)/u);
  assert.match(scheduler, /interval === 1/u);
  assert.match(scheduler, /balancedCandidates\.push\(product\)/u);
  assert.match(scheduler, /rotatedCandidates\.slice\(0, window\.target\)/u);
  assert.doesNotMatch(scheduler, /isDue\(/u);
  assert.doesNotMatch(wrapper, /dailyCrawlBrandOverrideEnabled|dailyCrawlBrands/u);
});

test("巡回周期は一括確認し、同日で構成が同じなら既存プランを再利用する", async () => {
  const wrapper = await readFile(
    new URL("../browser-extension/popular-refresh-wrapper.js", import.meta.url),
    "utf8",
  );
  const serviceWorker = await readFile(
    new URL("../browser-extension/service-worker.js", import.meta.url),
    "utf8",
  );

  assert.match(wrapper, /function intervalSignature\(products\)/u);
  assert.match(wrapper, /cachedAutomaticPlan/u);
  assert.match(wrapper, /cachedAutomaticPlan\.signature !== signature/u);
  assert.match(wrapper, /cachedAutomaticPlan\.dateKey !== dateKey/u);
  assert.match(wrapper, /const reused = reuseCachedPlan\(source, signature, dateKey\)/u);
  assert.doesNotMatch(wrapper, /\/api\/products\/crawl-intervals\?ids=/u);
  assert.doesNotMatch(serviceWorker, /crawl-disabled-preflight-wrapper/u);
});

test("popupから日次巡回ブランド設定を廃止し、手動巡回も周期計算すると明示する", async () => {
  const html = await readFile(new URL("../browser-extension/popup.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<span class="setting-heading">日次巡回ブランド<\/span>/u);
  assert.match(html, /今すぐ巡回/u);
  assert.doesNotMatch(html, /今すぐ全件更新/u);
  assert.match(html, /1日 \/ 3日 \/ 7日 \/ 14日 \/ 無/u);
  assert.match(html, /同じ均等化アルゴリズムで本日の対象/u);
  assert.match(html, /周期構成に変更がなければ既存プラン/u);
  assert.doesNotMatch(html, /取得直前に再確認/u);
});
