import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../browser-extension/new-product-discovery-policy.js") as {
  DEFAULT_RELEASE_DISCOVERY_URL: string;
  normalizeReleaseDate(value: string): string | null;
  isReleaseDiscoveryUrl(value: string): boolean;
  shouldReplaceLegacyAutoAddUrl(value: string | null | undefined): boolean;
  selectReleaseDiscoveryProducts(
    products: Array<{ url: string; releaseDate: string | null }>,
    registeredIds: Set<string>,
    today: string,
    existingStopDate?: string | null,
  ): {
    products: Array<{ id: string; url: string; releaseDate: string }>;
    stopDate: string | null;
    reachedOlderDate: boolean;
    skippedFuture: number;
    skippedMissingDate: number;
    duplicateCount: number;
  };
};

function item(id: number, releaseDate: string | null) {
  return {
    url: `https://www.suruga-ya.jp/product/detail/${id}`,
    releaseDate,
  };
}

test("発売日表記を正規化する", () => {
  assert.equal(policy.normalizeReleaseDate("2026/8/8"), "2026-08-08");
  assert.equal(policy.normalizeReleaseDate("2026年08月08日"), "2026-08-08");
  assert.equal(policy.normalizeReleaseDate("2026-08-08"), "2026-08-08");
  assert.equal(policy.normalizeReleaseDate("2026/02/30"), null);
});

test("発売日降順の対象URLだけを新商品探索として扱う", () => {
  assert.equal(policy.isReleaseDiscoveryUrl(policy.DEFAULT_RELEASE_DISCOVERY_URL), true);
  assert.equal(
    policy.isReleaseDiscoveryUrl(
      "https://www.suruga-ya.jp/search?category=652042222&rankBy=release_date%28int%29%3Aascending",
    ),
    false,
  );
});

test("旧自動追加URLは発売日順URLへ移行対象にする", () => {
  assert.equal(policy.shouldReplaceLegacyAutoAddUrl(undefined), true);
  assert.equal(
    policy.shouldReplaceLegacyAutoAddUrl(
      "https://www.suruga-ya.jp/search?category=65204&genre2=%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%83%8E%E3%83%99%E3%83%AB%28%E7%BE%8E%E5%B0%91%E5%A5%B3%E3%82%B2%E3%83%BC%E3%83%A0%29&search_word=",
    ),
    true,
  );
  assert.equal(
    policy.shouldReplaceLegacyAutoAddUrl("https://www.suruga-ya.jp/search?category=600"),
    false,
  );
});

test("未来の予約商品は追加せず重複でも停止境界に使わない", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [
      item(100, "2026/09/01"),
      item(101, "2026/08/20"),
      item(102, "2026/08/08"),
      item(103, "2026/08/08"),
      item(104, "2026/08/08"),
      item(105, "2026/08/07"),
    ],
    new Set(["101", "103"]),
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["102", "104"]);
  assert.equal(result.stopDate, "2026-08-08");
  assert.equal(result.reachedOlderDate, true);
  assert.equal(result.skippedFuture, 2);
  assert.equal(result.duplicateCount, 1);
});

test("重複を見つけても同じ発売日の未登録商品は拾う", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [
      item(200, "2026/08/08"),
      item(201, "2026/08/08"),
      item(202, "2026/08/08"),
      item(203, "2026/08/07"),
    ],
    new Set(["200"]),
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["201", "202"]);
  assert.equal(result.stopDate, "2026-08-08");
  assert.equal(result.reachedOlderDate, true);
});

test("停止境界と同じ発売日が次ページへ続いても回収してから止める", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [
      item(300, "2026/08/08"),
      item(301, "2026/08/08"),
      item(302, "2026/08/07"),
    ],
    new Set(["300"]),
    "2026-08-08",
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["301"]);
  assert.equal(result.reachedOlderDate, true);
});

test("発売日を読めない商品は予約判定できないので追加も停止判定もしない", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [item(400, null), item(401, "2026/08/08")],
    new Set(["400"]),
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["401"]);
  assert.equal(result.stopDate, null);
  assert.equal(result.skippedMissingDate, 1);
});
