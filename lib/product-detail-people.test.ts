import assert from "node:assert/strict";
import test from "node:test";
import { preserveIndividualDetailPeople } from "./product-detail-people";
import type { FetchedProduct } from "./surugaya";

function product(details: Record<string, string>): FetchedProduct {
  return {
    title: "テスト商品",
    imageUrl: null,
    managementNumber: null,
    manufacturer: null,
    releaseDate: null,
    listPrice: null,
    modelNumber: null,
    category: null,
    details,
    junkItems: [],
    salePrice: null,
    buyPrice: null,
    stockStatus: "unknown",
  };
}

test("同じ項目に複数いる担当者を一人ずつ改行して保存する", () => {
  const fetched = preserveIndividualDetailPeople(
    `
      <table>
        <tr>
          <th>シナリオ</th>
          <td><a>麻枝准</a><a>久弥直樹</a></td>
        </tr>
        <tr>
          <th>原画</th>
          <td><a>樋上いたる</a><a>Na-Ga</a></td>
        </tr>
      </table>
    `,
    product({ シナリオ: "麻枝准", 原画: "樋上いたる" }),
  );

  assert.equal(fetched.details["シナリオ"], "麻枝准\n久弥直樹");
  assert.equal(fetched.details["原画"], "樋上いたる\nNa-Ga");
});

test("同じ人物の重複と表記上の余分な空白を除く", () => {
  const fetched = preserveIndividualDetailPeople(
    `
      <dl>
        <dt>声優</dt>
        <dd><a>田中 花子</a><a>田中　花子</a><a>佐藤太郎</a></dd>
      </dl>
    `,
    product({ 声優: "田中 花子" }),
  );

  assert.equal(fetched.details["声優"], "田中 花子\n佐藤太郎");
});
