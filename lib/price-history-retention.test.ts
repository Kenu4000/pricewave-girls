import assert from "node:assert/strict";
import test from "node:test";
import {
  priceHistoryIdsToDelete,
  type PriceHistorySnapshot,
} from "./price-history-retention";

function snapshot(
  id: number,
  salePrice: number | null,
  buyPrice: number | null,
  stockStatus = "in_stock",
  isTimeSale = false,
  checkedAt: Date | string = "2026-08-05T12:00:00+09:00",
): PriceHistorySnapshot {
  return { id, salePrice, buyPrice, stockStatus, isTimeSale, checkedAt };
}

test("10件以内の価格履歴は削除しない", () => {
  const histories = Array.from({ length: 10 }, (_, index) =>
    snapshot(index + 1, 3000, 1000),
  );
  assert.deepEqual(priceHistoryIdsToDelete(histories), []);
});

test("10件を超えた同日内の完全一致データを削除する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 3000, 1000),
    snapshot(12, 3000, 1000),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [11, 12]);
});

test("価格と在庫が同じでも取得日が異なる履歴は保持する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 3000, 1000, "in_stock", false, "2026-08-04T12:00:00+09:00"),
    snapshot(12, 3000, 1000, "in_stock", false, "2026-08-03T12:00:00+09:00"),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), []);
});

test("日本時間の日付境界をまたぐ同一価格は削除しない", () => {
  const histories = [
    ...Array.from({ length: 9 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(10, 3000, 1000, "in_stock", false, "2026-08-04T15:30:00Z"),
    snapshot(11, 3000, 1000, "in_stock", false, "2026-08-04T14:30:00Z"),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), []);
});

test("異なる価格は変化点として保護し、同日の重複だけ削除する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => snapshot(index + 1, 3000, 1000)),
    snapshot(11, 2800, 900),
    snapshot(12, 2800, 900),
    snapshot(13, 2800, 900, "out_of_stock"),
    snapshot(14, 2800, 900, "out_of_stock"),
    snapshot(15, null, null, "unknown", false, "2026-08-04T12:00:00+09:00"),
  ];

  assert.deepEqual(priceHistoryIdsToDelete(histories), [12, 14]);
});

test("nullを含む販売・買取・在庫も同日内では完全一致として比較する", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) =>
      snapshot(index + 1, null, null, "unknown"),
    ),
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
