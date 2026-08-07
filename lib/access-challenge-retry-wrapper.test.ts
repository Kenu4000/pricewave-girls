import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const wrapperSource = readFileSync(
  new URL("../browser-extension/access-challenge-retry-wrapper.js", import.meta.url),
  "utf8",
);

type WorkerContext = vm.Context & {
  storageData: Record<string, unknown>;
  createdAlarms: Array<{ name: string; info: Record<string, unknown> }>;
  startedTriggers: string[];
  scriptResults: unknown[];
};

function createWorkerContext(initialStorage: Record<string, unknown> = {}): WorkerContext {
  const storageData: Record<string, unknown> = { ...initialStorage };
  const createdAlarms: Array<{ name: string; info: Record<string, unknown> }> = [];
  const startedTriggers: string[] = [];
  const alarmListeners: Array<(alarm: { name: string }) => void> = [];
  const sandbox: Record<string, unknown> = {
    storageData,
    createdAlarms,
    startedTriggers,
    scriptResults: [],
  };
  const context = vm.createContext(sandbox) as WorkerContext;

  function storageGet(keys: unknown) {
    if (typeof keys === "string") return { [keys]: storageData[keys] };
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, storageData[String(key)]]));
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

  sandbox.chrome = {
    storage: {
      local: {
        async get(keys: unknown) {
          return storageGet(keys);
        },
        async set(items: Record<string, unknown>) {
          Object.assign(storageData, items);
        },
        async remove(keys: string | string[]) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete storageData[key];
        },
      },
    },
    scripting: {
      async executeScript() {
        return context.scriptResults;
      },
    },
    alarms: {
      async create(name: string, info: Record<string, unknown>) {
        createdAlarms.push({ name, info });
      },
      async clear() {
        return true;
      },
      onAlarm: {
        addListener(listener: (alarm: { name: string }) => void) {
          alarmListeners.push(listener);
        },
      },
    },
  };

  sandbox.importScripts = (...fileNames: string[]) => {
    assert.deepEqual(fileNames, ["popular-refresh-wrapper.js"]);
    vm.runInContext(
      `
        const UPDATE_INTERVAL_MS = 1_000;
        const AUTO_UPDATE_RETRY_ALARM = "surugaya-daily-update-retry";
        class AccessChallengeError extends Error {}
        class TaskCancelledError extends Error {}
        async function updateOneProduct() {}
        let mockStatus = { state: "idle", message: "" };
        async function getStatus() { return { ...mockStatus }; }
        async function setStatus(patch) {
          mockStatus = { ...mockStatus, ...patch };
          return { ...mockStatus };
        }
        async function requestLocal(path) {
          return { result: { products: [] }, origin: "mock" };
        }
        async function processProductsInParallel(
          products,
          requestedParallelTabs,
          describeProduct,
          processor = updateOneProduct,
          intervalMs = UPDATE_INTERVAL_MS,
        ) {
          let succeeded = 0;
          let failed = 0;

          for (const product of products) {
            if (product.outcome === "cancel") {
              const error = new TaskCancelledError("処理を停止しました。");
              error.succeeded = succeeded;
              error.failed = failed;
              throw error;
            }
            try {
              await processor(product);
              succeeded += 1;
            } catch (error) {
              failed += 1;
              if (error instanceof AccessChallengeError) {
                error.succeeded = succeeded;
                error.failed = failed;
                throw error;
              }
            }
          }

          return { succeeded, failed };
        }
        async function runAllProducts(trigger) {
          const response = await requestLocal("/api/products");
          globalThis.seenResumeProducts = response.result.products;
          if (globalThis.mockRunStatus) {
            mockStatus = { ...mockStatus, ...globalThis.mockRunStatus };
          } else {
            mockStatus = { ...mockStatus, state: "completed", message: "完了" };
          }
        }
        function startRun(trigger) {
          globalThis.startedTriggers.push(trigger);
          return true;
        }
      `,
      context,
      { filename: "popular-refresh-wrapper.js" },
    );
  };

  vm.runInContext(wrapperSource, context, {
    filename: "access-challenge-retry-wrapper.js",
  });
  return context;
}

async function runScenario(context: WorkerContext, outcomes: string[]) {
  context.outcomes = outcomes;

  const result = (await vm.runInContext(
    `
      (async () => {
        const products = outcomes.map((outcome, index) => ({
          outcome,
          index,
          id: index + 1,
          title: "商品" + (index + 1),
          url: "https://www.suruga-ya.jp/product/detail/" + (1000 + index),
        }));
        try {
          const result = await processProductsInParallel(
            products,
            1,
            () => "",
            async (product) => {
              if (product.outcome === "challenge" || product.outcome === "hard-block") {
                const error = new AccessChallengeError("アクセス確認");
                if (product.outcome === "hard-block") error.nonSkippable = true;
                throw error;
              }
              if (product.outcome === "error") {
                throw new Error("通常エラー");
              }
            },
            0,
          );
          return { kind: "result", ...result };
        } catch (error) {
          return {
            kind: "error",
            name: error.name,
            message: error.message,
            succeeded: error.succeeded,
            failed: error.failed,
          };
        }
      })()
    `,
    context,
  )) as Record<string, unknown>;

  return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
}

test("最初のアクセス確認だけなら商品をスキップして次へ進む", async () => {
  const result = await runScenario(createWorkerContext(), ["challenge", "success"]);
  assert.deepEqual(result, { kind: "result", succeeded: 1, failed: 1 });
});

test("2商品連続のアクセス確認で停止位置以降を保存する", async () => {
  const context = createWorkerContext();
  const result = await runScenario(context, ["challenge", "challenge", "success"]);
  assert.deepEqual(result, {
    kind: "error",
    name: "Error",
    message: "駿河屋のアクセス確認が2商品連続で表示されたため、この位置で一時停止しました。",
    succeeded: 0,
    failed: 2,
  });

  const checkpoint = context.storageData.crawlResumeCheckpoint as {
    reason: string;
    autoResume: boolean;
    remainingProducts: Array<{ id: number }>;
  };
  assert.equal(checkpoint.reason, "access-challenge");
  assert.equal(checkpoint.autoResume, true);
  assert.deepEqual(checkpoint.remainingProducts.map((product) => product.id), [2, 3]);
});

test("テストモードではアクセス確認が連続しても最後まで進む", async () => {
  const context = createWorkerContext({ continueThroughAccessChallenges: true });
  const result = await runScenario(context, ["challenge", "challenge", "success"]);
  assert.deepEqual(result, { kind: "result", succeeded: 1, failed: 2 });
  assert.equal(context.storageData.crawlResumeCheckpoint, undefined);
});

test("テストモードでも403・429相当の強制停止はスキップしない", async () => {
  const context = createWorkerContext({ continueThroughAccessChallenges: true });
  const result = await runScenario(context, ["hard-block", "success"]);
  assert.equal(result.kind, "error");
  const checkpoint = context.storageData.crawlResumeCheckpoint as {
    reason: string;
    autoResume: boolean;
  };
  assert.equal(checkpoint.reason, "policy-block");
  assert.equal(checkpoint.autoResume, false);
});

test("成功または通常エラーを挟んだ場合は連続回数をリセットする", async () => {
  const afterSuccess = await runScenario(createWorkerContext(), [
    "challenge",
    "success",
    "challenge",
    "challenge",
  ]);
  assert.equal(afterSuccess.kind, "error");
  assert.equal(afterSuccess.succeeded, 1);
  assert.equal(afterSuccess.failed, 3);

  const afterOrdinaryError = await runScenario(createWorkerContext(), [
    "challenge",
    "error",
    "challenge",
    "success",
  ]);
  assert.deepEqual(afterOrdinaryError, {
    kind: "result",
    succeeded: 1,
    failed: 3,
  });
});

test("手動停止でも未処理の残りを保存する", async () => {
  const context = createWorkerContext();
  const result = await runScenario(context, ["success", "cancel", "success"]);
  assert.equal(result.kind, "error");
  const checkpoint = context.storageData.crawlResumeCheckpoint as {
    reason: string;
    remainingProducts: Array<{ id: number }>;
  };
  assert.equal(checkpoint.reason, "cancelled");
  assert.deepEqual(checkpoint.remainingProducts.map((product) => product.id), [2, 3]);
});

test("手動再開では保存済みの残りリストだけを使う", async () => {
  const remainingProducts = [
    { id: 7, title: "商品7", url: "https://www.suruga-ya.jp/product/detail/1007" },
    { id: 8, title: "商品8", url: "https://www.suruga-ya.jp/product/detail/1008" },
  ];
  const context = createWorkerContext({
    crawlResumeRequested: true,
    crawlResumeCheckpoint: {
      remainingProducts,
      reason: "cancelled",
      autoResume: false,
      savedAt: Date.now(),
    },
  });

  await vm.runInContext(`runAllProducts("manual")`, context);
  const seen = JSON.parse(JSON.stringify(context.seenResumeProducts)) as Array<{ id: number }>;
  assert.deepEqual(seen.map((product) => product.id), [7, 8]);
  assert.equal(context.storageData.crawlResumeCheckpoint, undefined);
});

test("アクセス確認停止後は1分後の再開アラームを設定する", async () => {
  const context = createWorkerContext({
    crawlResumeRequested: true,
    crawlResumeCheckpoint: {
      remainingProducts: [
        { id: 9, title: "商品9", url: "https://www.suruga-ya.jp/product/detail/1009" },
      ],
      reason: "access-challenge",
      autoResume: true,
      savedAt: Date.now(),
    },
  });
  context.mockRunStatus = { state: "blocked", message: "一時停止" };

  await vm.runInContext(`runAllProducts("manual")`, context);
  const alarm = JSON.parse(JSON.stringify(context.createdAlarms.at(-1)));
  assert.deepEqual(alarm, {
    name: "surugaya-daily-update-retry",
    info: { delayInMinutes: 1 },
  });
});

test("403・429ページはアクセス確認継続モードの対象外にする", async () => {
  const context = createWorkerContext();
  context.scriptResults = [
    {
      result: {
        title: "403 Forbidden",
        html: "<h1>403 Forbidden</h1>",
        isAccessChallenge: true,
      },
    },
  ];

  const result = (await vm.runInContext(
    `(async () => {
      try {
        await chrome.scripting.executeScript({});
        return { blocked: false };
      } catch (error) {
        return { blocked: true, nonSkippable: error.nonSkippable, message: error.message };
      }
    })()`,
    context,
  )) as Record<string, unknown>;
  assert.equal(result.blocked, true);
  assert.equal(result.nonSkippable, true);
});
