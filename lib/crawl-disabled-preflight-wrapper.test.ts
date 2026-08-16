import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wrapper = readFileSync(
  new URL("../browser-extension/crawl-disabled-preflight-wrapper.js", import.meta.url),
  "utf8",
);
const serviceWorker = readFileSync(
  new URL("../browser-extension/service-worker.js", import.meta.url),
  "utf8",
);
const popup = readFileSync(
  new URL("../browser-extension/popup.html", import.meta.url),
  "utf8",
);

test("手動全件更新でも開始時点の無設定を対象外にする", () => {
  assert.match(
    wrapper,
    /selected\.filter\(\(product\) => product\?\.crawlIntervalDays !== null\)/u,
  );
});

test("登録商品は取得直前に現在の巡回周期を再確認して無なら開かない", () => {
  assert.match(wrapper, /\/api\/products\/crawl-intervals\?ids=/u);
  assert.match(wrapper, /if \(interval === null\)/u);
  assert.match(wrapper, /return originalUpdateOneProduct\(product, sessionId\)/u);
  assert.ok(
    wrapper.indexOf("if (interval === null)") <
      wrapper.indexOf("return originalUpdateOneProduct(product, sessionId)"),
  );
});

test("直前確認wrapperをService Workerの最後に読み込む", () => {
  assert.match(
    serviceWorker,
    /"fast-site-mode-wrapper\.js",\s*"crawl-disabled-preflight-wrapper\.js"/u,
  );
});

test("popupでも無は手動全件更新から除外すると明示する", () => {
  assert.match(popup, /「無」は自動巡回・手動全件更新のどちらからも除外/u);
  assert.match(popup, /取得直前に再確認してスキップ/u);
  assert.doesNotMatch(popup, /手動全件更新には含まれます/u);
});
