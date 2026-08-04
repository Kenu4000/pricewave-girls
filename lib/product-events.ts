type ProductChangeListener = () => void;

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

export function notifyProductsChanged() {
  for (const listener of getListeners()) {
    try {
      listener();
    } catch {
      // A disconnected browser must not make the database update fail.
    }
  }
}
