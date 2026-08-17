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

function pricewaveWaitForDocumentReady() {
  if (document.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener("DOMContentLoaded", resolve, { once: true });
  });
}

function pricewaveHasOtherShopOffers(productId) {
  const expectedPath = `/product/other/${productId}`;
  const hasLink = [...document.querySelectorAll("a[href]")].some((anchor) => {
    try {
      return new URL(anchor.getAttribute("href"), window.location.href).pathname === expectedPath;
    } catch {
      return false;
    }
  });
  const text = document.body?.innerText || "";
  return hasLink || /他のショップ|近くの店舗に在庫|全ての取扱店舗を見る/.test(text);
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
    function onLoad() { cleanup(); resolve(); }
    function onError() { cleanup(); reject(new Error("他ショップ一覧を読み込めませんでした。")); }
    frame.addEventListener("load", onLoad, { once: true });
    frame.addEventListener("error", onError, { once: true });
  });
}

function pricewaveMarker(root) {
  let marker = document.getElementById(PRICEWAVE_OTHER_SHOPS_DATA_ID);
  if (marker) return marker;
  marker = document.createElement("textarea");
  marker.id = PRICEWAVE_OTHER_SHOPS_DATA_ID;
  marker.hidden = true;
  marker.dataset.state = "loading";
  root.append(marker);
  return marker;
}

async function pricewaveReadOtherShops(productId) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.setAttribute("aria-hidden", "true");
  const url = new URL(`/product/other/${productId}`, window.location.origin);
  url.searchParams.set("pricewave_snapshot", "structured");
  url.searchParams.set("pricewave_ts", String(Date.now()));
  frame.src = url.toString();
  document.documentElement.append(frame);
  try {
    await pricewaveWaitForFrame(frame);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const frameDocument = frame.contentDocument;
    const html = frameDocument?.documentElement?.outerHTML ?? "";
    const title = frameDocument?.title?.trim() ?? "";
    if (!html || /^(Just a moment|Attention Required)/i.test(title) || /cf-chl-|challenge-platform/i.test(html)) {
      throw new Error("他ショップ一覧がアクセス確認画面になっています。");
    }
    return html;
  } finally {
    frame.remove();
  }
}

async function pricewaveCaptureOtherShops() {
  const productId = pricewaveProductId();
  if (!productId) return;
  const root = await pricewaveWaitForDocumentRoot();
  if (document.getElementById(PRICEWAVE_OTHER_SHOPS_DATA_ID)) return;
  const marker = pricewaveMarker(root);
  await pricewaveWaitForDocumentReady();
  if (!pricewaveHasOtherShopOffers(productId)) {
    marker.dataset.state = "not_applicable";
    return;
  }
  try {
    marker.textContent = await pricewaveReadOtherShops(productId);
    marker.dataset.state = "ready";
  } catch (error) {
    marker.dataset.state = "error";
    marker.dataset.error = error instanceof Error ? error.message : "他ショップ一覧を取得できませんでした。";
  }
}

void pricewaveCaptureOtherShops();
