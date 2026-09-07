import assert from "node:assert/strict";
import test from "node:test";
import { formatProductDisplayTitle, splitProductDisplayTitle } from "./product-display-title";

test("Windows機種・媒体前置きを商品名の末尾へ移す", () => {
  const input = "WindowsXP/Vista/7 DVDソフト 闇夜に踊れ -Witch wishes to commit the Night-";
  assert.equal(
    formatProductDisplayTitle(input),
    "闇夜に踊れ -Witch wishes to commit the Night-　WindowsXP/Vista/7 DVDソフト",
  );
});

test("DVD ソフトのように途中に空白があっても前置きをまとめて移す", () => {
  const input = "WindowsXP/Vista/7/8 DVD ソフト ランス01 光をもとめて";
  assert.deepEqual(splitProductDisplayTitle(input), {
    title: "ランス01 光をもとめて",
    suffix: "WindowsXP/Vista/7/8 DVD ソフト",
  });
});

test("CDソフトや旧Windows表記にも対応する", () => {
  assert.equal(
    formatProductDisplayTitle("Windows98/Me/2000/XP CDソフト 鬼畜王ランス"),
    "鬼畜王ランス　Windows98/Me/2000/XP CDソフト",
  );
});

test("通常の商品名やタイトル中のソフトという語は変更しない", () => {
  assert.equal(formatProductDisplayTitle("戦国ランス"), "戦国ランス");
  assert.equal(formatProductDisplayTitle("ソフトウェアの少女"), "ソフトウェアの少女");
});
