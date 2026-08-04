const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");
const productLink = document.querySelector("#product-link");

function showStatus(message, kind) {
  status.textContent = message;
  status.dataset.kind = kind;
}

function isSurugayaProductUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const isSurugaya =
      url.hostname === "suruga-ya.jp" || url.hostname.endsWith(".suruga-ya.jp");
    return isSurugaya && /^\/product\/detail\/[0-9]+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function importCurrentPage() {
  importButton.disabled = true;
  productLink.hidden = true;
  showStatus("商品ページを読み取っています…", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !isSurugayaProductUrl(tab.url)) {
      throw new Error("駿河屋の商品詳細ページを開いてから実行してください。");
    }

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        url: window.location.href,
        html: document.documentElement.outerHTML,
        title: document.title,
      }),
    });
    const page = injection?.result;

    if (!page?.html || /^(Just a moment|Attention Required)/i.test(page.title)) {
      throw new Error("アクセス確認ではなく、商品ページが表示されてから実行してください。");
    }

    const response = await fetch("http://localhost:3000/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: page.url, html: page.html }),
    });
    const result = await response.json();

    if (!response.ok || !result.id) {
      throw new Error(result.error || "PriceWaveへの記録に失敗しました。");
    }

    showStatus("販売価格・買取価格・在庫状態を記録しました。", "success");
    productLink.href = `http://localhost:3000/products/${result.id}`;
    productLink.hidden = false;
  } catch (error) {
    const message =
      error instanceof TypeError
        ? "PriceWaveに接続できません。先に npm.cmd run dev を実行してください。"
        : error instanceof Error
          ? error.message
          : "取込に失敗しました。";
    showStatus(message, "error");
  } finally {
    importButton.disabled = false;
  }
}

importButton.addEventListener("click", importCurrentPage);
