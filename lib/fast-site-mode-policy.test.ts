import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../browser-extension/fast-site-mode-policy.js") as {
  MIN_PARALLEL_TABS: number;
  MAX_PARALLEL_TABS: number;
  DEFAULT_PARALLEL_TABS: number;
  normalizeParallelTabs(value: unknown): number;
  effectiveParallelTabs(enabled: boolean, requestedTabs: unknown): number;
};

test("旧仕様どおり同時タブ数を1から100まで指定できる", () => {
  assert.equal(policy.MIN_PARALLEL_TABS, 1);
  assert.equal(policy.MAX_PARALLEL_TABS, 100);
  assert.equal(policy.normalizeParallelTabs(1), 1);
  assert.equal(policy.normalizeParallelTabs(10), 10);
  assert.equal(policy.normalizeParallelTabs(100), 100);
});

test("同時タブ数は範囲外を1から100へ収める", () => {
  assert.equal(policy.normalizeParallelTabs(0), 1);
  assert.equal(policy.normalizeParallelTabs(101), 100);
  assert.equal(policy.normalizeParallelTabs("不正"), policy.DEFAULT_PARALLEL_TABS);
});

test("高速モードOFFでは常に1タブ、ONでは指定数を使う", () => {
  assert.equal(policy.effectiveParallelTabs(false, 25), 1);
  assert.equal(policy.effectiveParallelTabs(true, 25), 25);
});
