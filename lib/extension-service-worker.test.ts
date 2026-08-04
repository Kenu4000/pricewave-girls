import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function extensionSource(fileName: string): string {
  return readFileSync(new URL(`../browser-extension/${fileName}`, import.meta.url), "utf8");
}

test("人気順更新ラッパーと安全巡回Workerを同じService Workerで読み込める", () => {
  const sources = new Map([
    ["crawl-policy.js", extensionSource("crawl-policy.js")],
    ["safe-background.js", extensionSource("safe-background.js")],
  ]);
  const listener = { addListener() {}, removeListener() {} };
  const chrome = {
    storage: {
      local: {
        async get() {
          return {};
        },
        async set() {},
      },
      onChanged: listener,
    },
    tabs: {
      async create() {
        return { id: 1 };
      },
      async remove() {},
      async get() {
        return { id: 1, status: "complete" };
      },
      onRemoved: listener,
      onUpdated: listener,
    },
    scripting: {
      async executeScript() {
        return [];
      },
    },
    runtime: { onMessage: listener },
    alarms: { onAlarm: listener },
  };
  const context = vm.createContext({
    chrome,
    fetch: async () => {
      throw new Error("このテストでは通信しません。");
    },
    URL,
    Headers,
    Response,
    setTimeout,
    clearTimeout,
  });

  context.importScripts = (...fileNames: string[]) => {
    for (const fileName of fileNames) {
      if (fileName === "background.js") continue;
      const source = sources.get(fileName);
      if (!source) throw new Error(`テスト対象外のスクリプトです: ${fileName}`);
      vm.runInContext(source, context, { filename: fileName });
    }
  };

  assert.doesNotThrow(() => {
    vm.runInContext(extensionSource("popular-refresh-wrapper.js"), context, {
      filename: "popular-refresh-wrapper.js",
    });
  });
});
