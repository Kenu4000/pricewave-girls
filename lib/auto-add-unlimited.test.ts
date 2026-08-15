import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const background = readFileSync(
  new URL("../browser-extension/background.js", import.meta.url),
  "utf8",
);
const popupHtml = readFileSync(
  new URL("../browser-extension/popup.html", import.meta.url),
  "utf8",
);
const popupWrapper = readFileSync(
  new URL("../browser-extension/auto-add-unlimited-popup.js", import.meta.url),
  "utf8",
);

test("未登録商品の追加件数は1000件を超えて指定できる", () => {
  assert.match(background, /function normalizeAutoAddLimit/u);
  assert.doesNotMatch(background, /Math\.min\(1_000/u);
  assert.match(background, /normalizeAutoAddLimit\(message\.limit, 1\)/u);
  assert.match(background, /normalizeAutoAddLimit\(stored\.autoAddLimit\)/u);
});

test("popupの追加件数入力から1000件上限を外す", () => {
  const input = popupHtml.match(/<input id="auto-add-limit"[^>]*>/u)?.[0] ?? "";
  assert.ok(input);
  assert.doesNotMatch(input, /\smax=/u);
  assert.match(popupHtml, /<script src="popup\.js"><\/script>\s*<script src="auto-add-unlimited-popup\.js"><\/script>/u);
});

test("保存済みの1000件超設定をpopupで1000へ丸めない", () => {
  const input = { removeAttribute() {} };
  const context = vm.createContext({
    document: { querySelector: () => input },
    normalizedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
      const number = Number(value);
      return Number.isInteger(number)
        ? Math.min(maximum, Math.max(minimum, number))
        : fallback;
    },
    Number,
  });

  vm.runInContext(popupWrapper, context, { filename: "auto-add-unlimited-popup.js" });
  assert.equal(context.normalizedInteger(25_000, 1, 1_000, 1_000), 25_000);
  assert.equal(context.normalizedInteger(250, 1, 100, 10), 100);
});
