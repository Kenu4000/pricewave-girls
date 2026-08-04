import assert from "node:assert/strict";
import test from "node:test";
import { extractAlternateConditionItemsSafely } from "./alternate-condition-items";

test("送料無料条件の1,500円を最後の状態価格として取得しない", () => {
  const items = extractAlternateConditionItemsSafely(`
    <html><body>
      <h2>その他の状態を選ぶ</h2>
      <div>中古 箱不備（小） 4,200円（税込）</div>
      <div>中古 ディスクのみ 2,800円（税込）</div>
      <p>1,500円以上お買上げで送料無料</p>
      <h2>商品詳細情報</h2>
    </body></html>
  `);

  assert.deepEqual(items, [
    {
      sourceType: "alternate_condition",
      storeName: null,
      condition: "中古 箱不備（小）",
      price: 4200,
    },
    {
      sourceType: "alternate_condition",
      storeName: null,
      condition: "中古 ディスクのみ",
      price: 2800,
    },
  ]);
});

test("タイムセールは税込表記までにある最後の価格を採用する", () => {
  const items = extractAlternateConditionItemsSafely(`
    <html><body>
      <h2>その他の状態を選ぶ</h2>
      <div>中古 帯付き ※タイムセール 3,900円 3,500円（税込）</div>
      <p>1,500円以上お買上げで送料無料</p>
    </body></html>
  `);

  assert.equal(items[0]?.price, 3500);
  assert.equal(items[0]?.condition, "中古 帯付き");
});
