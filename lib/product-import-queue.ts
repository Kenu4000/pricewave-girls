import { AsyncBatcher } from "@/lib/async-batcher";
import {
  upsertProductSnapshots,
  type ProductSnapshotInput,
} from "@/lib/product-snapshots";

const IMPORT_BATCH_SIZE = 100;
const IMPORT_FLUSH_DELAY_MS = 50;

const globalForImportQueue = globalThis as unknown as {
  productImportQueue?: AsyncBatcher<ProductSnapshotInput, number>;
};

export const productImportQueue =
  globalForImportQueue.productImportQueue ??
  new AsyncBatcher<ProductSnapshotInput, number>({
    maxBatchSize: IMPORT_BATCH_SIZE,
    flushDelayMs: IMPORT_FLUSH_DELAY_MS,
    processBatch: async (inputs) => {
      const products = await upsertProductSnapshots(inputs);
      return products.map((product) => product.id);
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForImportQueue.productImportQueue = productImportQueue;
}
