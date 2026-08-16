(() => {
  const policy = globalThis.PricewaveCrawlPolicy;
  const originalSelectScheduledProducts = policy?.selectScheduledProducts?.bind(policy);
  const originalUpdateOneProduct = updateOneProduct;
  const originalProcessProductsAndCommit = processProductsAndCommit;
  let disabledSkipCount = 0;

  function isRegisteredProduct(product) {
    const id = Number(product?.id);
    return (
      typeof product?.title === "string" &&
      Number.isInteger(id) &&
      id > 0
    );
  }

  async function currentCrawlIntervalDays(product) {
    const id = Number(product.id);
    const { result } = await requestLocal(
      `/api/products/crawl-intervals?ids=${encodeURIComponent(String(id))}`,
    );
    const intervals = result?.intervals;
    const key = String(id);
    if (!intervals || !Object.prototype.hasOwnProperty.call(intervals, key)) {
      throw new Error(`商品${id}の現在の巡回周期を確認できませんでした。`);
    }
    return intervals[key];
  }

  // 手動全件更新でも、開始時点で「無」の商品は最初から対象外にする。
  // 自動巡回では元のスケジューラが既に除外するが、ここでも最終防衛線として除外する。
  if (originalSelectScheduledProducts) {
    policy.selectScheduledProducts = (products, ...args) => {
      const plan = originalSelectScheduledProducts(products, ...args);
      const selected = Array.isArray(plan?.products) ? plan.products : [];
      const filtered = selected.filter((product) => product?.crawlIntervalDays !== null);
      const removed = selected.length - filtered.length;
      if (removed === 0) return plan;

      return {
        ...plan,
        products: filtered,
        dailyCount: Math.max(0, (Number(plan?.dailyCount) || 0) - removed),
      };
    };
  }

  // キューに入った後で周期が「無」へ変更される場合があるため、
  // 駿河屋の商品タブを開く直前にローカルDBの現在値を必ず再確認する。
  updateOneProduct = async function updateOneProductWithDisabledPreflight(
    product,
    sessionId = null,
  ) {
    if (isRegisteredProduct(product)) {
      const interval = await currentCrawlIntervalDays(product);
      if (interval === null) {
        disabledSkipCount += 1;
        const error = new Error(
          `${product.title} は巡回周期が「無」のため取得をスキップしました。`,
        );
        error.name = "CrawlDisabledSkipError";
        error.crawlDisabledSkip = true;
        throw error;
      }
    }

    return originalUpdateOneProduct(product, sessionId);
  };

  // 基本処理ではスキップ用例外も一時的に failed として数えるため、
  // 最終結果から「無」によるスキップ件数だけ差し引く。
  processProductsAndCommit = async function processProductsAndCommitWithoutDisabledFailures(
    ...args
  ) {
    disabledSkipCount = 0;
    try {
      const result = await originalProcessProductsAndCommit(...args);
      const skipped = disabledSkipCount;
      if (skipped === 0) return result;
      return {
        ...result,
        failed: Math.max(0, (Number(result?.failed) || 0) - skipped),
        skipped,
      };
    } catch (error) {
      const skipped = disabledSkipCount;
      if (skipped > 0 && Number.isInteger(error?.failed)) {
        error.failed = Math.max(0, error.failed - skipped);
        error.skipped = skipped;
      }
      throw error;
    } finally {
      disabledSkipCount = 0;
    }
  };
})();
