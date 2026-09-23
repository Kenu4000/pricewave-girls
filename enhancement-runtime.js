(() => {
  const app = document.querySelector('#app');
  if (!app || globalThis.PricewaveViewerEnhancements) return;

  const enhancements = new Map();
  let scheduled = false;
  let running = false;
  let rerunRequested = false;

  async function runEnhancements() {
    scheduled = false;
    if (running) {
      rerunRequested = true;
      return;
    }

    running = true;
    try {
      for (const [name, enhancement] of enhancements) {
        try {
          await enhancement();
        } catch (error) {
          console.error(`Viewer enhancement failed: ${name}`, error);
        }
      }
    } finally {
      running = false;
      if (rerunRequested) {
        rerunRequested = false;
        schedule();
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      void runEnhancements();
    });
  }

  globalThis.PricewaveViewerEnhancements = {
    register(name, enhancement) {
      if (typeof name !== 'string' || typeof enhancement !== 'function') return () => {};
      enhancements.set(name, enhancement);
      schedule();
      return () => enhancements.delete(name);
    },
    schedule,
  };

  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pricewave:viewer-rendered', schedule);
  schedule();
})();
