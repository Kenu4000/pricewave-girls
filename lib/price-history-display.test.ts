import assert from "node:assert/strict";
import test from "node:test";
import { selectDisplayedPriceHistories } from "./price-history-display";

type History = {
  id: number;
  salePrice: number | null;
  regularSalePrice?: number | null;
  buyPrice: number | null;
  stockStatus?: string | null;
};

function history(
  id: number,
  salePrice: number | null,
  buyPrice: number | null,
  regularSalePrice: number | null = salePrice,
  stockStatus = "in_stock",
): History {
  return { id, salePrice, regularSalePrice, buyPrice, stockStatus };
}

test("直近10件は価格が同じでもすべて表示する", () => {
  const histories = Array.from({ length: 10 }, (_, index) => history(index + 1, 3000, 1000));
  assert.deepEqual(selectDisplayedPriceHistories(histories).map((item) => item.id), [1,2,3,4,5,6,7,8,9,10]);
});

test("10件より古い同価格履歴は隠し、価格変化点だけ表示する", () => {
  const histories = [
    ...Array.from({ length: 12 }, (_, index) => history(index + 1, 3000, 1000)),
    history(13, 2800, 900),
    history(14, 2800, 900),
    history(15, 3500, 1200),
  ];

  assert.deepEqual(
    selectDisplayedPriceHistories(histories).map((item) => item.id),
    [1,2,3,4,5,6,7,8,9,10,13,15],
  );
});

test("販売価格が同じでも通常価格または買取価格が変われば表示する", () => {
  const recent = Array.from({ length: 10 }, (_, index) => history(index + 1, 3000, 1000, 3500));
  const histories = [
    ...recent,
    history(11, 3000, 1000, 4000),
    history(12, 3000, 800, 4000),
  ];

  assert.deepEqual(
    selectDisplayedPriceHistories(histories).map((item) => item.id),
    [1,2,3,4,5,6,7,8,9,10,11,12],
  );
});

test("古い履歴で在庫だけ変わっても価格履歴表には追加しない", () => {
  const histories = [
    ...Array.from({ length: 10 }, (_, index) => history(index + 1, 3000, 1000)),
    history(11, 3000, 1000, 3000, "out_of_stock"),
  ];

  assert.deepEqual(
    selectDisplayedPriceHistories(histories).map((item) => item.id),
    [1,2,3,4,5,6,7,8,9,10],
  );
});
