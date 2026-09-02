import assert from "node:assert/strict";
import test from "node:test";
import {
  allDisabledManufacturerKeys,
  manufacturerIdentityKey,
} from "./new-product-crawl-interval";

test("既存商品がすべて巡回周期無のメーカーを停止継承対象にする", () => {
  const keys = allDisabledManufacturerKeys([
    { manufacturer: "カスタム", crawlIntervalDays: null },
    { manufacturer: "カスタム", crawlIntervalDays: null },
  ]);

  assert.ok(keys.has(manufacturerIdentityKey("カスタム")!));
});

test("同一メーカーに有効な巡回周期が1件でもあれば停止継承しない", () => {
  const keys = allDisabledManufacturerKeys([
    { manufacturer: "Navel", crawlIntervalDays: null },
    { manufacturer: "Navel", crawlIntervalDays: 3 },
  ]);

  assert.ok(!keys.has(manufacturerIdentityKey("Navel")!));
});

test("LeafとAQUAPLUSの別名も同一メーカーとして判定する", () => {
  const keys = allDisabledManufacturerKeys([
    { manufacturer: "Leaf", crawlIntervalDays: null },
    { manufacturer: "AQUAPLUS", crawlIntervalDays: null },
    { manufacturer: "アクアプラス", crawlIntervalDays: null },
  ]);

  assert.ok(keys.has(manufacturerIdentityKey("Leaf")!));
  assert.equal(manufacturerIdentityKey("Leaf"), manufacturerIdentityKey("AQUAPLUS"));
});

test("既存商品がないメーカーは停止継承対象にならない", () => {
  const keys = allDisabledManufacturerKeys([]);
  assert.ok(!keys.has(manufacturerIdentityKey("新規メーカー")!));
});
