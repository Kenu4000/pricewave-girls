import assert from "node:assert/strict";
import test from "node:test";
import { extractOtherShopItems } from "./surugaya";

test("他店舗一覧の単独ランクBコンディションを取得する", () => {
  const items = extractOtherShopItems(`
    <html><body>
      <table><tbody>
        <tr>
          <td>22,540円</td>
          <td><a href="/product/detail/145045023?branch_number=1000&tenpo_cd=400464">ランクB</a></td>
          <td><a href="/shop/400464">駿河屋柏青葉台店の出品を見る</a></td>
        </tr>
      </tbody></table>
    </body></html>
  `);

  assert.deepEqual(items, [
    {
      sourceType: "other_shop",
      storeName: "駿河屋柏青葉台店",
      condition: "ランクB",
      price: 22540,
    },
  ]);
});

test("ランクBの閉じ括弧表記もコンディションとして取得する", () => {
  const items = extractOtherShopItems(`
    <html><body>
      <table><tbody>
        <tr>
          <td>18,000円</td>
          <td>ランクB)</td>
          <td><a>駿河屋大阪店の出品を見る</a></td>
        </tr>
      </tbody></table>
    </body></html>
  `);

  assert.equal(items[0]?.condition, "ランクB)");
  assert.equal(items[0]?.price, 18000);
});
