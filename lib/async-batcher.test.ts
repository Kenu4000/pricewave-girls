import assert from "node:assert/strict";
import test from "node:test";
import { AsyncBatcher } from "./async-batcher";

test("上限まで集まった項目を1回のバッチで処理する", async () => {
  const batches: number[][] = [];
  const batcher = new AsyncBatcher<number, number>({
    maxBatchSize: 3,
    flushDelayMs: 1_000,
    processBatch: async (items) => {
      batches.push(items);
      return items.map((item) => item * 10);
    },
  });

  const results = await Promise.all([batcher.enqueue(1), batcher.enqueue(2), batcher.enqueue(3)]);

  assert.deepEqual(results, [10, 20, 30]);
  assert.deepEqual(batches, [[1, 2, 3]]);
});

test("上限未満でも待機時間後に処理する", async () => {
  const batches: string[][] = [];
  const batcher = new AsyncBatcher<string, string>({
    maxBatchSize: 100,
    flushDelayMs: 5,
    processBatch: async (items) => {
      batches.push(items);
      return items.map((item) => item.toUpperCase());
    },
  });

  assert.equal(await batcher.enqueue("one"), "ONE");
  assert.deepEqual(batches, [["one"]]);
});

test("バッチ保存の失敗を同じバッチの全項目へ返す", async () => {
  const expected = new Error("write failed");
  const batcher = new AsyncBatcher<number, number>({
    maxBatchSize: 2,
    flushDelayMs: 1_000,
    processBatch: async () => {
      throw expected;
    },
  });

  const first = batcher.enqueue(1);
  const second = batcher.enqueue(2);

  await assert.rejects(first, expected);
  await assert.rejects(second, expected);
});

test("保存中に届いた項目を次のバッチで処理する", async () => {
  const batches: number[][] = [];
  let releaseFirstBatch: (() => void) | undefined;
  const firstBatchBlocked = new Promise<void>((resolve) => {
    releaseFirstBatch = resolve;
  });
  const batcher = new AsyncBatcher<number, number>({
    maxBatchSize: 2,
    flushDelayMs: 5,
    processBatch: async (items) => {
      batches.push(items);
      if (batches.length === 1) await firstBatchBlocked;
      return items;
    },
  });

  const first = batcher.enqueue(1);
  const second = batcher.enqueue(2);
  const third = batcher.enqueue(3);
  releaseFirstBatch?.();

  assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 3]);
  assert.deepEqual(batches, [[1, 2], [3]]);
});
