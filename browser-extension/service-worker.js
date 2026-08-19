importScripts("snapshot-readiness-wrapper.js", "fast-site-mode-wrapper.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "pricewave:history") return undefined;

  const productCode = String(message.productCode || "").trim();
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    sendResponse({ ok: false, status: 400, error: "商品コードが不正です。" });
    return false;
  }

  void fetch(`http://localhost:3000/api/surugaya-history/${encodeURIComponent(productCode)}`, {
    cache: "no-store",
  })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      sendResponse({
        ok: response.ok,
        status: response.status,
        ...data,
      });
    })
    .catch(() => {
      sendResponse({
        ok: false,
        status: 0,
        unavailable: true,
        error: "Pricewaveローカルアプリに接続できません。",
      });
    });

  return true;
});
