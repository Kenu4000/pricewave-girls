import assert from "node:assert/strict";
import test from "node:test";
import { includesSearchText, normalizeSearchText } from "./search-text";

test("商品名検索はASCIIの大文字小文字を区別しない", () => {
  assert.equal(includesSearchText("Kanon KEY Memorial", "key"), true);
  assert.equal(includesSearchText("Kanon key Memorial", "KEY"), true);
  assert.equal(includesSearchText("Kanon KeY Memorial", "kEy"), true);
});

test("検索文字列は全角英字も同じ文字として扱う", () => {
  assert.equal(normalizeSearchText("ＫＥＹ"), "key");
  assert.equal(includesSearchText("KEY", "ｋｅｙ"), true);
});
