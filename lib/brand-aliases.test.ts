import assert from "node:assert/strict";
import test from "node:test";
import { resolveBrandIdentity } from "./brand-aliases";

function assertSameBrand(expectedLabel: string, values: string[]) {
  const identities = values.map((value) => resolveBrandIdentity(value));
  assert.ok(identities.length > 0);
  for (const identity of identities) {
    assert.equal(identity.key, identities[0].key);
    assert.equal(identity.label, expectedLabel);
  }
}

test("Littlewitchの英字・日本語表記とvelvetレーベルを同一ブランドにまとめる", () => {
  assertSameBrand("Littlewitch（リトルウィッチ）", [
    "Littlewitch",
    "LITTLEWITCH",
    "littlewitch",
    "リトルウィッチ",
    "リトルウイッチ",
    "Littlewitch velvet",
    "リトルウィッチ・ベルベット",
  ]);
});

test("fengの英字・日本語読みを同一ブランドにまとめる", () => {
  assertSameBrand("feng（フォン）", ["feng", "FENG", "フォン", "ふぉん"]);
});

test("F&Cの主要レーベルをF&Cとしてまとめる", () => {
  assertSameBrand("F&C", [
    "F&C",
    "F&C・FC01",
    "F&C･FC02",
    "COCKTAIL SOFT",
    "カクテル・ソフト",
    "FAIRYTALE",
    "フェアリーテール",
    "FAIRYTALE ETHIX",
    "HARDCOVER",
  ]);
});
