import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJunkHistoryViewSections,
  countJunkHistoryItems,
  type JunkHistoryViewItem,
} from "./junk-history-view";

function item(
  id: number,
  checkedAt: string,
  overrides: Partial<JunkHistoryViewItem> = {},
): JunkHistoryViewItem {
  return {
    id,
    sourceType: "other_shop",
    storeName: "駿河屋大阪店",
    condition: "中古 箱不備（小）",
    price: 2500,
    checkedAt,
    ...overrides,
  };
}

test("最新の価格取得時点に近い履歴を販売中へ分ける", () => {
  const sections = buildJunkHistoryViewSections(
    [
      item(1, "2026-08-05T01:00:00.000Z"),
      item(2, "2026-08-05T02:00:01.000Z", { storeName: "駿河屋高槻店" }),
    ],
    "2026-08-05T02:00:00.000Z",
  );

  assert.equal(sections.current.length, 1);
  assert.deepEqual(sections.current[0].items.map((entry) => entry.id), [2]);
  assert.deepEqual(sections.past[0].items.map((entry) => entry.id), [1]);
});

test("同じ取得時点のデータを一つのグループにまとめる", () => {
  const sections = buildJunkHistoryViewSections(
    [
      item(1, "2026-08-05T02:00:00.100Z"),
      item(2, "2026-08-05T02:00:00.900Z", { storeName: "駿河屋高槻店" }),
    ],
    "2026-08-05T02:00:00.000Z",
  );

  assert.equal(sections.current.length, 1);
  assert.equal(sections.current[0].items.length, 2);
});

test("同一と思われるデータは最新の一件だけ残す", () => {
  const sections = buildJunkHistoryViewSections(
    [
      item(1, "2026-08-05T01:00:00.000Z"),
      item(2, "2026-08-05T02:00:00.000Z", {
        storeName: "駿河屋 大阪店",
        condition: "中古　箱不備（小）",
      }),
    ],
    "2026-08-05T02:00:00.000Z",
  );

  assert.equal(countJunkHistoryItems(sections.current), 1);
  assert.equal(countJunkHistoryItems(sections.past), 0);
});

test("価格が異なるデータは過去データとして残す", () => {
  const sections = buildJunkHistoryViewSections(
    [
      item(1, "2026-08-05T01:00:00.000Z", { price: 3000 }),
      item(2, "2026-08-05T02:00:00.000Z", { price: 2500 }),
    ],
    "2026-08-05T02:00:00.000Z",
  );

  assert.equal(countJunkHistoryItems(sections.current), 1);
  assert.equal(countJunkHistoryItems(sections.past), 1);
});

test("最新取得時点から離れた履歴は販売中にしない", () => {
  const sections = buildJunkHistoryViewSections(
    [item(1, "2026-08-05T01:00:00.000Z")],
    "2026-08-05T02:00:00.000Z",
  );

  assert.equal(sections.current.length, 0);
  assert.equal(countJunkHistoryItems(sections.past), 1);
});
