import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const script = readFileSync(
  new URL("../viewer/product-title-display.js", import.meta.url),
  "utf8",
);
const html = readFileSync(
  new URL("../viewer/index.html", import.meta.url),
  "utf8",
);

test("Viewerの商品名表示整形スクリプトを構文解析できる", () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test("ViewerでもWindows機種・媒体前置きを末尾へ移す", () => {
  let enhancement: (() => void) | null = null;
  const app = { querySelectorAll: () => [] };
  const context = vm.createContext({
    document: { querySelector: () => app },
    PricewaveViewerEnhancements: {
      register: (_name: string, callback: () => void) => {
        enhancement = callback;
      },
    },
  });
  new vm.Script(script).runInContext(context);

  const formatter = (context as unknown as {
    PricewaveProductTitleDisplay: { formatProductDisplayTitle(value: string): string };
  }).PricewaveProductTitleDisplay.formatProductDisplayTitle;

  assert.equal(
    formatter("WindowsXP/Vista/7 DVDソフト 闇夜に踊れ -Witch wishes to commit the Night-"),
    "闇夜に踊れ -Witch wishes to commit the Night-　WindowsXP/Vista/7 DVDソフト",
  );
  assert.equal(formatter("戦国ランス"), "戦国ランス");
  assert.equal(typeof enhancement, "function");
});

test("Viewerは既存の単一MutationObserver基盤へ表示整形を登録する", () => {
  assert.match(script, /PricewaveViewerEnhancements/u);
  assert.match(script, /runtime\.register\('product-title-display'/u);
  assert.doesNotMatch(script, /new MutationObserver/u);
});

test("商品名表示整形はhome-uiより前に読み込む", () => {
  const formatterIndex = html.indexOf("./product-title-display.js");
  const runtimeIndex = html.indexOf("./enhancement-runtime.js");
  const homeIndex = html.indexOf("./home-ui.js");
  assert.ok(runtimeIndex >= 0);
  assert.ok(formatterIndex > runtimeIndex);
  assert.ok(homeIndex > formatterIndex, "home-ui.jsは引き続き最後に読み込む");
});
