import assert from "node:assert/strict";
import test from "node:test";
import { priceHistoryIdsToDelete, type PriceHistorySnapshot } from "./price-history-retention";

function snapshot(
  id: number,
  salePrice: number | null,
  buyPrice: number | null,
  stockStatus = "in_stock",
  isTimeSale = false,
): PriceHistorySnapshot {
  return { id, salePrice, buyPrice, stockStatus, isTimeSale };
}

test("10件以内の価格履歴は削除しない", () => {
  const histories = Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000));
  assert.deepEqual(priceHistoryIdsToDelete(histories), []);
});

test("10件を超えた完全一致データを削除する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 3000, 1000),
    snapshot(12, 3000, 1000),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [11, 12]);
});

test("異なる価格は変化点として保護し、以降の同一データだけ削除する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 2800, 900),
    snapshot(12, 2800, 900),
    snapshot(13, 2800, 900, "out_of_stock"),
    snapshot(14, 2800, 900, "out_of_stock"),
    snapshot(15, null, null, "unknown"),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [12, 14]);
});

test("nullを含む販売・買取・在庫も完全一致として比較する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, null, null, "unknown")),
    snapshot(11, null, null, "unknown"),
    snapshot(12, null, 500, "unknown"),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [11]);
});

test("価格が同じでもタイムセール状態が変われば履歴を残す", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 3000, 1000, "in_stock", true),
    snapshot(12, 3000, 1000, "in_stock", true),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [12]);
});
