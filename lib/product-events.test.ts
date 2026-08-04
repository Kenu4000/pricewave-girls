import assert from "node:assert/strict";
import test from "node:test";
import { notifyProductsChanged, subscribeToProductChanges } from "./product-events";

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
