import type { ProductPreview } from "@/lib/product-preview";

export type ProductChangeEvent =
  | { type: "changed" }
  | {
      type: "batch-saved";
      sessionId: string;
      savedCount: number;
      products: ProductPreview[];
    }
  | { type: "import-finished"; sessionId: string; savedCount: number };

type ProductChangeListener = (event: ProductChangeEvent) => void;

const productEventsGlobal = globalThis as typeof globalThis & {
  productChangeListeners?: Set<ProductChangeListener>;
};

function getListeners() {
  productEventsGlobal.productChangeListeners ??= new Set<ProductChangeListener>();
  return productEventsGlobal.productChangeListeners;
}

export function subscribeToProductChanges(listener: ProductChangeListener) {
  const listeners = getListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: ProductChangeEvent) {
  for (const listener of getListeners()) {
    try {
      listener(event);
    } catch {
      // A disconnected browser must not make the database update fail.
    }
  }
}

export function notifyProductsChanged() {
  notify({ type: "changed" });
}

export function notifyProductBatchSaved(
  sessionId: string,
  savedCount: number,
  products: ProductPreview[],
) {
  notify({ type: "batch-saved", sessionId, savedCount, products });
}

export function notifyProductImportFinished(sessionId: string, savedCount: number) {
  notify({ type: "import-finished", sessionId, savedCount });
}
