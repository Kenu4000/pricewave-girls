const PRICEWAVE_OTHER_SHOPS_DATA_ID = "pricewave-other-shops-data";
const PRICEWAVE_OTHER_SHOPS_TIMEOUT_MS = 20_000;

function pricewaveProductId() {
  return window.location.pathname.match(/^\/product\/detail\/([0-9A-Za-z]+)\/?$/)?.[1] ?? null;
}

function pricewaveWaitForDocumentRoot() {
  if (document.documentElement) return Promise.resolve(document.documentElement);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      resolve(document.documentElement);
    });
    observer.observe(document, { childList: true });
  });
}

function pricewaveWaitForFrame(frame) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("他ショップ一覧の読込がタイムアウトしました。"));
    }, PRICEWAVE_OTHER_SHOPS_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      frame.removeEventListener("load", onLoad);
      frame.removeEventListener("error", onError);
    }

    function onLoad() {
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("他ショップ一覧を読み込めませんでした。"));
    }

    frame.addEventListener("load", onLoad, { once: true });
    frame.addEventListener("error", onError, { once: true });
  });
}

async function pricewaveCaptureOtherShops() {
  const productId = pricewaveProductId();
  if (!productId) return;

  const root = await pricewaveWaitForDocumentRoot();
  if (document.getElementById(PRICEWAVE_OTHER_SHOPS_DATA_ID)) return;

  const marker = document.createElement("textarea");
  marker.id = PRICEWAVE_OTHER_SHOPS_DATA_ID;
  marker.hidden = true;
  marker.dataset.state = "loading";
  root.append(marker);

  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.setAttribute("aria-hidden", "true");
  frame.src = `https://www.suruga-ya.jp/product/other/${productId}`;
  root.append(frame);

  try {
    await pricewaveWaitForFrame(frame);
    const frameDocument = frame.contentDocument;
    const html = frameDocument?.documentElement?.outerHTML ?? "";
    const title = frameDocument?.title?.trim() ?? "";

    if (
      !html ||
      /^(Just a moment|Attention Required)/i.test(title) ||
      /cf-chl-|challenge-platform/i.test(html)
    ) {
      throw new Error("他ショップ一覧がアクセス確認画面になっています。");
    }

    marker.textContent = html;
    marker.dataset.state = "ready";
  } catch (error) {
    marker.dataset.state = "error";
    marker.dataset.error = error instanceof Error ? error.message : "他ショップ一覧を取得できませんでした。";
  } finally {
    frame.remove();
  }
}

void pricewaveCaptureOtherShops();
