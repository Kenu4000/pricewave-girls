const PRICEWAVE_OTHER_SHOPS_DATA_ID = "pricewave-other-shops-data";
const PRICEWAVE_OTHER_SHOPS_MOBILE_DATA_ID = "pricewave-other-shops-mobile-data";
const PRICEWAVE_OTHER_SHOPS_TIMEOUT_MS = 20_000;
const PRICEWAVE_MOBILE_UA_PORT = "pricewave-mobile-other-shops";

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
  return hasLink || /他のショップ/.test(document.body?.innerText || "");
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

function pricewaveMarker(root, id) {
  let marker = document.getElementById(id);
  if (marker) return marker;
  marker = document.createElement("textarea");
  marker.id = id;
  marker.hidden = true;
  marker.dataset.state = "loading";
  root.append(marker);
  return marker;
}

function pricewaveMobileUaPort() {
  const port = chrome.runtime.connect({ name: PRICEWAVE_MOBILE_UA_PORT });
  let requestId = 0;
  const pending = new Map();

  port.onMessage.addListener((message) => {
    const resolver = pending.get(message?.requestId);
    if (!resolver) return;
    pending.delete(message.requestId);
    if (message.ok) resolver.resolve();
    else resolver.reject(new Error(message.error || "モバイル表示の準備に失敗しました。"));
  });

  port.onDisconnect.addListener(() => {
    for (const resolver of pending.values()) {
      resolver.reject(new Error("モバイル表示の準備中に接続が切れました。"));
    }
    pending.clear();
  });

  return {
    setEnabled(enabled) {
      requestId += 1;
      const currentId = requestId;
      return new Promise((resolve, reject) => {
        pending.set(currentId, { resolve, reject });
        port.postMessage({ requestId: currentId, enabled: Boolean(enabled) });
      });
    },
    disconnect() {
      port.disconnect();
    },
  };
}

async function pricewaveReadFrame(productId, variant) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.setAttribute("aria-hidden", "true");
  const url = new URL(`/product/other/${productId}`, window.location.origin);
  url.searchParams.set("pricewave_snapshot", variant);
  url.searchParams.set("pricewave_ts", String(Date.now()));
  frame.src = url.toString();
  document.documentElement.append(frame);

  try {
    await pricewaveWaitForFrame(frame);
    await new Promise((resolve) => setTimeout(resolve, 350));
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

  const desktopMarker = pricewaveMarker(root, PRICEWAVE_OTHER_SHOPS_DATA_ID);
  const mobileMarker = pricewaveMarker(root, PRICEWAVE_OTHER_SHOPS_MOBILE_DATA_ID);

  await pricewaveWaitForDocumentReady();
  if (!pricewaveHasOtherShopOffers(productId)) {
    desktopMarker.dataset.state = "not_applicable";
    mobileMarker.dataset.state = "not_applicable";
    return;
  }

  const mobileUa = pricewaveMobileUaPort();
  try {
    await mobileUa.setEnabled(true);
    const [desktopResult, mobileResult] = await Promise.allSettled([
      pricewaveReadFrame(productId, "desktop"),
      pricewaveReadFrame(productId, "mobile"),
    ]);

    if (desktopResult.status === "fulfilled") {
      desktopMarker.textContent = desktopResult.value;
      desktopMarker.dataset.state = "ready";
    } else {
      desktopMarker.dataset.state = "error";
      desktopMarker.dataset.error = desktopResult.reason instanceof Error
        ? desktopResult.reason.message
        : "PC版の他ショップ一覧を取得できませんでした。";
    }

    if (mobileResult.status === "fulfilled") {
      mobileMarker.textContent = mobileResult.value;
      mobileMarker.dataset.state = "ready";
    } else {
      mobileMarker.dataset.state = "error";
      mobileMarker.dataset.error = mobileResult.reason instanceof Error
        ? mobileResult.reason.message
        : "モバイル版の他ショップ一覧を取得できませんでした。";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "他ショップ一覧を取得できませんでした。";
    if (desktopMarker.dataset.state === "loading") {
      desktopMarker.dataset.state = "error";
      desktopMarker.dataset.error = message;
    }
    if (mobileMarker.dataset.state === "loading") {
      mobileMarker.dataset.state = "error";
      mobileMarker.dataset.error = message;
    }
  } finally {
    await mobileUa.setEnabled(false).catch(() => {});
    mobileUa.disconnect();
  }
}

void pricewaveCaptureOtherShops();
