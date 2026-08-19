import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const policy = require("../browser-extension/new-product-discovery-policy.js") as {
  DEFAULT_RELEASE_DISCOVERY_URL: string;
  LEGACY_WINDOWS_RELEASE_DISCOVERY_URL: string;
  normalizeReleaseDate(value: string): string | null;
  isReleaseDiscoveryUrl(value: string): boolean;
  shouldReplaceLegacyAutoAddUrl(value: string | null | undefined): boolean;
  selectReleaseDiscoveryProducts(
    products: Array<{ url: string; releaseDate: string | null }>,
    registeredIds: Set<string>,
    today: string,
    existingStopDate?: string | null,
  ): {
    products: Array<{ id: string; url: string; releaseDate: string | null }>;
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

test("新商品探索の既定範囲はWindows限定ではなくアダルトPCソフト全体", () => {
  const url = new URL(policy.DEFAULT_RELEASE_DISCOVERY_URL);
  assert.equal(url.searchParams.get("category"), "6520422");
  assert.equal(url.searchParams.get("adult_s"), "3");
  assert.equal(policy.isReleaseDiscoveryUrl(policy.DEFAULT_RELEASE_DISCOVERY_URL), true);
  assert.equal(
    policy.isReleaseDiscoveryUrl(
      "https://www.suruga-ya.jp/search?category=652042206&rankBy=release_date%28int%29%3Adescending",
    ),
    true,
  );
  assert.equal(
    policy.isReleaseDiscoveryUrl(
      "https://www.suruga-ya.jp/search?category=652042222&rankBy=release_date%28int%29%3Aascending",
    ),
    false,
  );
});

test("旧自動追加URLとWindows限定の旧既定URLはPCソフト全体へ移行対象にする", () => {
  assert.equal(policy.shouldReplaceLegacyAutoAddUrl(undefined), true);
  assert.equal(
    policy.shouldReplaceLegacyAutoAddUrl(
      "https://www.suruga-ya.jp/search?category=65204&genre2=%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%83%8E%E3%83%99%E3%83%AB%28%E7%BE%8E%E5%B0%91%E5%A5%B3%E3%82%B2%E3%83%BC%E3%83%A0%29&search_word=",
    ),
    true,
  );
  assert.equal(
    policy.shouldReplaceLegacyAutoAddUrl(policy.LEGACY_WINDOWS_RELEASE_DISCOVERY_URL),
    true,
  );
  assert.equal(
    policy.shouldReplaceLegacyAutoAddUrl("https://www.suruga-ya.jp/search?category=600"),
    false,
  );
});

test("未来の予約商品は追加しないが登録済み商品では探索を止めない", () => {
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

  assert.deepEqual(result.products.map((product) => product.id), ["102", "104", "105"]);
  assert.equal(result.stopDate, null);
  assert.equal(result.reachedOlderDate, false);
  assert.equal(result.skippedFuture, 2);
  assert.equal(result.duplicateCount, 1);
});

test("登録済みしかないページの後にある古い未登録商品も拾える", () => {
  const registered = new Set(["200", "201", "202"]);
  const firstPage = policy.selectReleaseDiscoveryProducts(
    [
      item(200, "2026/08/08"),
      item(201, "2026/08/07"),
      item(202, "2026/08/06"),
    ],
    registered,
    "2026-08-08",
  );

  assert.deepEqual(firstPage.products, []);
  assert.equal(firstPage.reachedOlderDate, false);
  assert.equal(firstPage.stopDate, null);

  const laterPage = policy.selectReleaseDiscoveryProducts(
    [
      item(203, "2026/07/20"),
      item(204, "2026/07/01"),
    ],
    registered,
    "2026-08-08",
    firstPage.stopDate,
  );

  assert.deepEqual(laterPage.products.map((product) => product.id), ["203", "204"]);
  assert.equal(laterPage.reachedOlderDate, false);
});

test("登録済みと未登録が混在しても古い商品まで全件確認する", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [
      item(300, "2026/08/08"),
      item(301, "2026/08/08"),
      item(302, "2026/08/07"),
      item(303, "2026/07/01"),
    ],
    new Set(["300", "302"]),
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["301", "303"]);
  assert.equal(result.duplicateCount, 2);
  assert.equal(result.stopDate, null);
  assert.equal(result.reachedOlderDate, false);
});

test("発売日未登録の旧PCソフトも収集し、発売日が明示された未来商品だけ除外する", () => {
  const result = policy.selectReleaseDiscoveryProducts(
    [
      item(124000242, null),
      item(401, "2026/08/08"),
      item(402, "2026/09/01"),
    ],
    new Set(),
    "2026-08-08",
  );

  assert.deepEqual(result.products.map((product) => product.id), ["124000242", "401"]);
  assert.equal(result.products[0]?.releaseDate, null);
  assert.equal(result.skippedMissingDate, 1);
  assert.equal(result.skippedFuture, 1);
  assert.equal(result.stopDate, null);
});
