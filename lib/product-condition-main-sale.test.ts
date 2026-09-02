import assert from "node:assert/strict";
import test from "node:test";
import { detectPrimaryProductCondition } from "./time-sale";

function html(condition: string) {
  return `<html><body><h1>テスト商品</h1><div>中古 ${condition} 2,380円 (税込) 在庫数：1</div></body></html>`;
}

test("主販売欄の説明書欠けをランクBとして判定する", () => {
  assert.deepEqual(detectPrimaryProductCondition(html("説明書欠け")), {
    condition: "説明書欠け",
    conditionRank: "B",
  });
});

test("主販売欄の構成物のみ表記をランクBとして判定する", () => {
  assert.deepEqual(detectPrimaryProductCondition(html("ゲームディスク+説明書のみ")), {
    condition: "ゲームディスク+説明書のみ",
    conditionRank: "B",
  });
});

test("主販売欄の全角ランクＢもランクBとして判定する", () => {
  assert.deepEqual(detectPrimaryProductCondition(html("ランクＢ")), {
    condition: "ランクB",
    conditionRank: "B",
  });
});

test("主販売欄の通常商品はランクBにしない", () => {
  assert.deepEqual(detectPrimaryProductCondition(html("")), {
    condition: null,
    conditionRank: "A",
  });
});
