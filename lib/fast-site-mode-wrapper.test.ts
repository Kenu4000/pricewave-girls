import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const wrapperSource = readFileSync(
  new URL("../browser-extension/fast-site-mode-wrapper.js", import.meta.url),
  "utf8",
);
const policySource = readFileSync(
  new URL("../browser-extension/fast-site-mode-policy.js", import.meta.url),
  "utf8",
);
const discoveryPolicySource = readFileSync(
  new URL("../browser-extension/new-product-discovery-policy.js", import.meta.url),
  "utf8",
);

type Harness = {
  context: vm.Context;
  nativeCreateCalls(): number;
  safeCreateCalls(): number;
};

function createHarness(fastSiteModeEnabled: boolean, parallelTabs: number): Harness {
  const storageData: Record<string, unknown> = {
    fastSiteModeEnabled,
    parallelTabs,
  };
  let nativeCreateCount = 0;
  let safeCreateCount = 0;
  const changeListeners: Array<(changes: Record<string, unknown>, areaName: string) => void> = [];

  async function nativeStorageGet(keys: unknown) {
    if (typeof keys === "string") {
      return { [keys]: storageData[keys] };
    }
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, storageData[key]]));
    }
    if (keys && typeof keys === "object") {
      const defaults = keys as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [
          key,
          Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : fallback,
        ]),
      );
    }
    return { ...storageData };
  }

  const chrome = {
    storage: {
      local: {
        get: nativeStorageGet,
      },
      onChanged: {
        addListener(listener: (changes: Record<string, unknown>, areaName: string) => void) {
          changeListeners.push(listener);
        },
      },
    },
    tabs: {
      async create() {
        nativeCreateCount += 1;
        return { id: nativeCreateCount };
      },
    },
  };

  const context = vm.createContext({ chrome, URL });
  context.importScripts = (...fileNames: string[]) => {
    for (const fileName of fileNames) {
      if (fileName === "fast-site-mode-policy.js") {
        vm.runInContext(policySource, context, { filename: fileName });
        continue;
      }
      if (fileName === "new-product-discovery-policy.js") {
        vm.runInContext(discoveryPolicySource, context, { filename: fileName });
        continue;
      }
      if (fileName === "access-challenge-retry-wrapper.js") {
        chrome.storage.local.get = async (keys: unknown) => {
          const stored = await nativeStorageGet(keys);
          if (Object.prototype.hasOwnProperty.call(stored, "parallelTabs")) {
            stored.parallelTabs = 1;
          }
          return stored;
        };
        chrome.tabs.create = async () => {
          safeCreateCount += 1;
          return { id: 1000 + safeCreateCount };
        };
        continue;
      }
      throw new Error(`想定外のimportScriptsです: ${fileName}`);
    }
  };

  vm.runInContext(wrapperSource, context, { filename: "fast-site-mode-wrapper.js" });

  return {
    context,
    nativeCreateCalls: () => nativeCreateCount,
    safeCreateCalls: () => safeCreateCount,
  };
}

test("高速モードOFFでは安全な1タブ制御を使う", async () => {
  const harness = createHarness(false, 20);
  const stored = await harness.context.chrome.storage.local.get({ parallelTabs: 10 });
  assert.equal(stored.parallelTabs, 1);

  await harness.context.chrome.tabs.create({
    url: "https://www.suruga-ya.jp/product/detail/123456789",
  });
  assert.equal(harness.nativeCreateCalls(), 0);
  assert.equal(harness.safeCreateCalls(), 1);
});

test("高速モードONでは指定タブ数と実サイトの直接タブ作成を使う", async () => {
  const harness = createHarness(true, 37);
  const stored = await harness.context.chrome.storage.local.get({ parallelTabs: 10 });
  assert.equal(stored.parallelTabs, 37);

  await harness.context.chrome.tabs.create({
    url: "https://www.suruga-ya.jp/product/detail/123456789",
  });
  assert.equal(harness.nativeCreateCalls(), 1);
  assert.equal(harness.safeCreateCalls(), 0);
});

test("高速モードONでも駿河屋以外のタブは安全側へ渡す", async () => {
  const harness = createHarness(true, 10);
  await harness.context.chrome.tabs.create({ url: "http://localhost:3000" });
  assert.equal(harness.nativeCreateCalls(), 0);
  assert.equal(harness.safeCreateCalls(), 1);
});

test("旧自動追加URLは発売日順の新商品探索URLへ読み替える", async () => {
  const harness = createHarness(false, 10);
  const stored = await harness.context.chrome.storage.local.get({
    autoAddSourceUrl:
      "https://www.suruga-ya.jp/search?category=65204&genre2=%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%AB%E3%83%8E%E3%83%99%E3%83%AB%28%E7%BE%8E%E5%B0%91%E5%A5%B3%E3%82%B2%E3%83%BC%E3%83%A0%29&search_word=",
  });
  assert.match(stored.autoAddSourceUrl, /category=652042222/u);
  assert.match(stored.autoAddSourceUrl, /rankBy=release_date/u);
});
