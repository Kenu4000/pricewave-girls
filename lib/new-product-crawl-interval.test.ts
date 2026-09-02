import assert from "node:assert/strict";
import test from "node:test";
import {
  allDisabledManufacturerKeys,
  manufacturerIdentityKey,
  uniformManufacturerCrawlIntervals,
} from "./new-product-crawl-interval";

test("既存商品がすべて巡回周期無のメーカーは新規も停止を継承する", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "カスタム", crawlIntervalDays: null },
    { manufacturer: "カスタム", crawlIntervalDays: null },
  ]);

  assert.equal(intervals.get(manufacturerIdentityKey("カスタム")!), null);
  assert.ok(allDisabledManufacturerKeys([
    { manufacturer: "カスタム", crawlIntervalDays: null },
  ]).has(manufacturerIdentityKey("カスタム")!));
});

test("既存商品がすべて7日なら新規も7日を継承する", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "Navel", crawlIntervalDays: 7 },
    { manufacturer: "Navel", crawlIntervalDays: 7 },
  ]);

  assert.equal(intervals.get(manufacturerIdentityKey("Navel")!), 7);
});

test("既存商品がすべて14日なら新規も14日を継承する", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "ぱれっと", crawlIntervalDays: 14 },
    { manufacturer: "ぱれっと", crawlIntervalDays: 14 },
  ]);

  assert.equal(intervals.get(manufacturerIdentityKey("ぱれっと")!), 14);
});

test("同一メーカーの巡回周期が混在していれば継承しない", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "Navel", crawlIntervalDays: null },
    { manufacturer: "Navel", crawlIntervalDays: 7 },
  ]);

  assert.ok(!intervals.has(manufacturerIdentityKey("Navel")!));
});

test("1日または3日だけで統一されていても新規へは特別継承しない", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "ブランドA", crawlIntervalDays: 1 },
    { manufacturer: "ブランドA", crawlIntervalDays: 1 },
    { manufacturer: "ブランドB", crawlIntervalDays: 3 },
    { manufacturer: "ブランドB", crawlIntervalDays: 3 },
  ]);

  assert.ok(!intervals.has(manufacturerIdentityKey("ブランドA")!));
  assert.ok(!intervals.has(manufacturerIdentityKey("ブランドB")!));
});

test("LeafとAQUAPLUSの別名も同一メーカーとして判定する", () => {
  const intervals = uniformManufacturerCrawlIntervals([
    { manufacturer: "Leaf", crawlIntervalDays: 14 },
    { manufacturer: "AQUAPLUS", crawlIntervalDays: 14 },
    { manufacturer: "アクアプラス", crawlIntervalDays: 14 },
  ]);

  assert.equal(intervals.get(manufacturerIdentityKey("Leaf")!), 14);
  assert.equal(manufacturerIdentityKey("Leaf"), manufacturerIdentityKey("AQUAPLUS"));
});

test("既存商品がないメーカーは継承対象にならない", () => {
  const intervals = uniformManufacturerCrawlIntervals([]);
  assert.ok(!intervals.has(manufacturerIdentityKey("新規メーカー")!));
});
