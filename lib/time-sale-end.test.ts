import assert from "node:assert/strict";
import test from "node:test";
import { detectTimeSaleEndAt } from "./time-sale-end";

const now = new Date("2026-08-08T00:00:00.000Z");

test("終了までの時分秒から終了日時を求める", () => {
  const result = detectTimeSaleEndAt(
    `<div><span>タイムセール</span><div>終了まで <b>01:02:03</b></div></div>`,
    now,
  );
  assert.equal(result?.toISOString(), "2026-08-08T01:02:03.000Z");
});

test("日数を含むカウントダウンを解析する", () => {
  const result = detectTimeSaleEndAt(
    `<div>終了まで 1日 02:03:04</div>`,
    now,
  );
  assert.equal(result?.toISOString(), "2026-08-09T02:03:04.000Z");
});

test("data-end属性の絶対時刻を優先する", () => {
  const result = detectTimeSaleEndAt(
    `<div><span>終了まで</span><time data-end="2026-08-08T14:59:00+09:00"></time></div>`,
    now,
  );
  assert.equal(result?.toISOString(), "2026-08-08T05:59:00.000Z");
});

test("その他の状態側だけの終了時刻は拾わない", () => {
  const result = detectTimeSaleEndAt(`
    <div>中古 6,000円 (税込)</div>
    <div>その他の状態を選ぶ</div>
    <div>終了まで 01:00:00</div>
  `, now);
  assert.equal(result, null);
});
