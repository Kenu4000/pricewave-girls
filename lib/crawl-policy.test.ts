import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../browser-extension/crawl-policy.js") as {
  MIN_PRODUCT_START_INTERVAL_MS: number;
  MAX_PRODUCT_START_INTERVAL_MS: number;
  calculateProductStartInterval(productCount: number): number;
  classifyPage(page: {
    title?: string;
    bodyText?: string;
    html?: string;
    isAccessChallenge?: boolean;
  }): "ok" | "blocked" | "temporary";
  serverRetryDelay(failureCount: number): number;
};

test("約1万商品は24時間へ分散できる間隔にする", () => {
  assert.equal(policy.calculateProductStartInterval(10_000), 8_640);
});

test("商品が多くても開始間隔は8秒未満にしない", () => {
  assert.equal(
    policy.calculateProductStartInterval(20_000),
    policy.MIN_PRODUCT_START_INTERVAL_MS,
  );
});

test("商品が少ない場合もサービスワーカー維持のため25秒を上限にする", () => {
  assert.equal(
    policy.calculateProductStartInterval(100),
    policy.MAX_PRODUCT_START_INTERVAL_MS,
  );
});

test("アクセス確認、403、429を停止対象として判定する", () => {
  assert.equal(policy.classifyPage({ title: "Just a moment..." }), "blocked");
  assert.equal(policy.classifyPage({ html: "<h1>403 Forbidden</h1>" }), "blocked");
  assert.equal(policy.classifyPage({ bodyText: "429 Too Many Requests" }), "blocked");
});

test("5xxを一時障害として判定する", () => {
  assert.equal(policy.classifyPage({ title: "503 Service Unavailable" }), "temporary");
  assert.equal(policy.classifyPage({ bodyText: "一時的にご利用いただけません" }), "temporary");
});

test("サーバー障害の待機時間を10分、30分、2時間へ延長する", () => {
  assert.equal(policy.serverRetryDelay(1), 10 * 60 * 1_000);
  assert.equal(policy.serverRetryDelay(2), 30 * 60 * 1_000);
  assert.equal(policy.serverRetryDelay(3), 2 * 60 * 60 * 1_000);
  assert.equal(policy.serverRetryDelay(10), 2 * 60 * 60 * 1_000);
});
