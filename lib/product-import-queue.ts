import { AsyncBatcher } from "@/lib/async-batcher";
import {
  manufacturerIdentityKey,
  uniformManufacturerCrawlIntervals,
  type InheritableCrawlInterval,
} from "@/lib/new-product-crawl-interval";
import { notifyProductsChanged } from "@/lib/product-events";
import type { ProductPreview } from "@/lib/product-preview";
import { type ProductSnapshotInput } from "@/lib/product-snapshots";
import { prisma } from "@/lib/prisma";
import { isReleaseDateTodayInJapan } from "@/lib/release-day-crawl";
import { upsertProductSnapshotsWithTimeSale } from "@/lib/time-sale-persistence";

const IMPORT_BATCH_SIZE = 100;
const IMPORT_FLUSH_DELAY_MS = 50;

type QueuedProductImport = {
  input: ProductSnapshotInput;
  notifyChanged: boolean;
};

const globalForImportQueue = globalThis as unknown as {
  productImportBatcher?: AsyncBatcher<QueuedProductImport, ProductPreview>;
};

const productImportBatcher =
  globalForImportQueue.productImportBatcher ??
  new AsyncBatcher<QueuedProductImport, ProductPreview>({
    maxBatchSize: IMPORT_BATCH_SIZE,
    flushDelayMs: IMPORT_FLUSH_DELAY_MS,
    processBatch: async (items) => {
      const inputs = items.map((item) => item.input);
      const existingProducts = await prisma.product.findMany({
        where: { surugayaUrl: { in: inputs.map((input) => input.surugayaUrl) } },
        select: { surugayaUrl: true },
      });
      const existingUrls = new Set(existingProducts.map((product) => product.surugayaUrl));
      const newManufacturerKeys = new Set(
        inputs.flatMap((input) => {
          if (
            existingUrls.has(input.surugayaUrl) ||
            isReleaseDateTodayInJapan(input.fetched.releaseDate)
          ) {
            return [];
          }
          const key = manufacturerIdentityKey(input.fetched.manufacturer);
          return key ? [key] : [];
        }),
      );

      let inheritedIntervals = new Map<string, InheritableCrawlInterval>();
      if (newManufacturerKeys.size > 0) {
        // 判定対象は保存前から存在する商品だけ。同じバッチで追加される新商品同士は
        // 「過去に登録済みの商品」には数えない。
        const manufacturerStates = await prisma.product.findMany({
          where: { manufacturer: { not: null } },
          select: { manufacturer: true, crawlIntervalDays: true },
        });
        inheritedIntervals = uniformManufacturerCrawlIntervals(
          manufacturerStates.filter((product) => {
            const key = manufacturerIdentityKey(product.manufacturer);
            return key !== null && newManufacturerKeys.has(key);
          }),
        );
      }

      // DB保存そのものから一律通知すると、自動更新でもrouter.refreshが走り、
      // 専用のライブ表示順が最後にサーバー描画結果で上書きされる。
      const products = await upsertProductSnapshotsWithTimeSale(inputs, { notify: false });

      const inheritedIdsByInterval = new Map<InheritableCrawlInterval, number[]>();
      for (let index = 0; index < products.length; index += 1) {
        const product = products[index];
        const input = inputs[index];
        if (
          !product ||
          !input ||
          existingUrls.has(input.surugayaUrl) ||
          isReleaseDateTodayInJapan(input.fetched.releaseDate)
        ) {
          continue;
        }
        const key = manufacturerIdentityKey(input.fetched.manufacturer);
        if (!key || !inheritedIntervals.has(key)) continue;
        const interval = inheritedIntervals.get(key)!;
        const ids = inheritedIdsByInterval.get(interval) ?? [];
        ids.push(product.id);
        inheritedIdsByInterval.set(interval, ids);
      }

      for (const [interval, ids] of inheritedIdsByInterval) {
        if (ids.length === 0) continue;
        await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { crawlIntervalDays: interval },
        });
      }

      // 手動記録は従来どおり通常の画面再読込で反映する。
      if (items.some((item) => item.notifyChanged)) {
        notifyProductsChanged();
      }
      return products;
    },
  });

export const productImportQueue = {
  enqueue(input: ProductSnapshotInput, options: { notify?: boolean } = {}) {
    return productImportBatcher.enqueue({
      input,
      notifyChanged: options.notify !== false,
    });
  },
  flushNow() {
    return productImportBatcher.flushNow();
  },
};

if (process.env.NODE_ENV !== "production") {
  globalForImportQueue.productImportBatcher = productImportBatcher;
}
