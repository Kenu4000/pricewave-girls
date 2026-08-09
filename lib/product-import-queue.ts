import { AsyncBatcher } from "@/lib/async-batcher";
import { notifyProductsChanged } from "@/lib/product-events";
import type { ProductPreview } from "@/lib/product-preview";
import { type ProductSnapshotInput } from "@/lib/product-snapshots";
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
      // DB保存そのものから一律通知すると、自動更新でもrouter.refreshが走り、
      // 専用のライブ表示順が最後にサーバー描画結果で上書きされる。
      const products = await upsertProductSnapshotsWithTimeSale(
        items.map((item) => item.input),
        { notify: false },
      );

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
