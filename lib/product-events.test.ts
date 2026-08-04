import assert from "node:assert/strict";
import test from "node:test";
import {
  notifyProductBatchSaved,
  notifyProductImportFinished,
  notifyProductsChanged,
  subscribeToProductChanges,
  type ProductChangeEvent,
} from "./product-events";

test("商品変更を購読中の画面へ通知し、解除後は通知しない", () => {
  let notifications = 0;
  const unsubscribe = subscribeToProductChanges(() => {
    notifications += 1;
  });

  notifyProductsChanged();
  assert.equal(notifications, 1);

  unsubscribe();
  notifyProductsChanged();
  assert.equal(notifications, 1);
});

test("切断済みの購読先で例外が起きても他の通知を続ける", () => {
  const unsubscribeBroken = subscribeToProductChanges(() => {
    throw new Error("disconnected");
  });
  let notifications = 0;
  const unsubscribeHealthy = subscribeToProductChanges(() => {
    notifications += 1;
  });

  assert.doesNotThrow(() => notifyProductsChanged());
  assert.equal(notifications, 1);

  unsubscribeBroken();
  unsubscribeHealthy();
});

test("100件単位の保存と取込完了を画面へ通知する", () => {
  const events: ProductChangeEvent[] = [];
  const unsubscribe = subscribeToProductChanges((event) => events.push(event));

  notifyProductBatchSaved("session", 100, [
    {
      id: 1,
      title: "商品",
      imageUrl: null,
      salePrice: 1_000,
      buyPrice: 500,
      manufacturer: "メーカー",
      releaseDate: "2026-08-04",
      modelNumber: "MODEL-1",
      stockStatus: "in_stock",
      hasHistory: true,
    },
  ]);
  notifyProductImportFinished("session", 100);

  assert.equal(events[0].type, "batch-saved");
  assert.equal(events[1].type, "import-finished");
  unsubscribe();
});
