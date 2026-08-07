import { prisma } from "@/lib/prisma";
import {
  upsertProductSnapshots,
  type ProductSnapshotInput,
} from "@/lib/product-snapshots";
import { timeSaleStateFromFetched } from "@/lib/time-sale";

export type TimeSaleTransition = {
  previousIsTimeSale: boolean;
  currentIsTimeSale: boolean;
  previousSalePrice: number | null;
  currentSalePrice: number | null;
};

export function shouldSuppressSalePriceChange(transition: TimeSaleTransition): boolean {
  return (
    transition.previousSalePrice !== transition.currentSalePrice &&
    (transition.previousIsTimeSale || transition.currentIsTimeSale)
  );
}

export async function upsertProductSnapshotsWithTimeSale(
  inputs: ProductSnapshotInput[],
  options: { notify?: boolean } = {},
) {
  if (inputs.length === 0) return [];

  const existingProducts = await prisma.product.findMany({
    where: { surugayaUrl: { in: inputs.map((input) => input.surugayaUrl) } },
    select: {
      id: true,
      surugayaUrl: true,
      latestSalePrice: true,
      salePriceChangedAt: true,
      isTimeSale: true,
    },
  });
  const existingByUrl = new Map(
    existingProducts.map((product) => [product.surugayaUrl, product]),
  );
  const startedAt = new Date();

  const products = await upsertProductSnapshots(inputs, options);
  const productIds = products.map((product) => product.id);
  const latestHistories = await prisma.priceHistory.findMany({
    where: { productId: { in: productIds } },
    orderBy: [{ productId: "asc" }, { id: "desc" }],
    select: { id: true, productId: true },
  });
  const latestHistoryIdByProduct = new Map<number, number>();
  for (const history of latestHistories) {
    if (!latestHistoryIdByProduct.has(history.productId)) {
      latestHistoryIdByProduct.set(history.productId, history.id);
    }
  }

  const operations = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const product = products[index];
    if (!product) continue;

    const previous = existingByUrl.get(input.surugayaUrl);
    const currentIsTimeSale = timeSaleStateFromFetched(input.fetched);
    const previousIsTimeSale = previous?.isTimeSale ?? false;
    const suppressSalePriceChange =
      previous !== undefined &&
      shouldSuppressSalePriceChange({
        previousIsTimeSale,
        currentIsTimeSale,
        previousSalePrice: previous.latestSalePrice,
        currentSalePrice: input.fetched.salePrice,
      });

    operations.push(
      prisma.product.update({
        where: { id: product.id },
        data: {
          previousIsTimeSale,
          isTimeSale: currentIsTimeSale,
          ...(suppressSalePriceChange
            ? { salePriceChangedAt: previous?.salePriceChangedAt ?? null }
            : {}),
        },
      }),
    );

    const historyId = latestHistoryIdByProduct.get(product.id);
    if (historyId !== undefined) {
      operations.push(
        prisma.priceHistory.update({
          where: { id: historyId },
          data: { isTimeSale: currentIsTimeSale },
        }),
      );
    }

    if (suppressSalePriceChange && previous) {
      operations.push(
        prisma.priceChange.deleteMany({
          where: {
            productId: product.id,
            type: "sale",
            previousPrice: previous.latestSalePrice,
            currentPrice: input.fetched.salePrice,
            changedAt: { gte: startedAt },
          },
        }),
      );
    }
  }

  if (operations.length > 0) await prisma.$transaction(operations);
  return products;
}
