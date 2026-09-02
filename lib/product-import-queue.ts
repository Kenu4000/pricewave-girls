import { AsyncBatcher } from "@/lib/async-batcher";
import {
  allDisabledManufacturerKeys,
  manufacturerIdentityKey,
} from "@/lib/new-product-crawl-interval";
import { notifyProductsChanged } from "@/lib/product-events";
import type { ProductPreview } from "@/lib/product-preview";
import { type ProductSnapshotInput } from "@/lib/product-snapshots";
import { prisma } from "@/lib/prisma";
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
          if (existingUrls.has(input.surugayaUrl)) return [];
          const key = manufacturerIdentityKey(input.fetched.manufacturer);
          return key ? [key] : [];
        }),
      );

      let disabledManufacturerKeys = new Set<string>();
      if (newManufacturerKeys.size > 0) {
        // 判定対象は保存前から存在する商品だけ。同じバッチで追加される新商品同士は
        // 「過去に登録済みの商品」には数えない。
        const manufacturerStates = await prisma.product.findMany({
          where: { manufacturer: { not: null } },
          select: { manufacturer: true, crawlIntervalDays: true },
        });
        disabledManufacturerKeys = allDisabledManufacturerKeys(
          manufacturerStates.filter((product) => {
            const key = manufacturerIdentityKey(product.manufacturer);
            return key !== null && newManufacturerKeys.has(key);
          }),
        );
      }

      // DB保存そのものから一律通知すると、自動更新でもrouter.refreshが走り、
      // 専用のライブ表示順が最後にサーバー描画結果で上書きされる。
      const products = await upsertProductSnapshotsWithTimeSale(inputs, { notify: false });

      const inheritedDisabledIds = products.flatMap((product, index) => {
        const input = inputs[index];
        if (!input || existingUrls.has(input.surugayaUrl)) return [];
        const key = manufacturerIdentityKey(input.fetched.manufacturer);
        return key && disabledManufacturerKeys.has(key) ? [product.id] : [];
      });
      if (inheritedDisabledIds.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: inheritedDisabledIds } },
          data: { crawlIntervalDays: null },
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
