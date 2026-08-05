import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const wrapperSource = readFileSync(
  new URL("../browser-extension/access-challenge-retry-wrapper.js", import.meta.url),
  "utf8",
);

function createWorkerContext(): vm.Context {
  const sandbox: Record<string, unknown> = {};
  const context = vm.createContext(sandbox);

  sandbox.importScripts = (...fileNames: string[]) => {
    assert.deepEqual(fileNames, ["popular-refresh-wrapper.js"]);
    vm.runInContext(
      `
        const UPDATE_INTERVAL_MS = 1_000;
        class AccessChallengeError extends Error {}
        async function updateOneProduct() {}
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

async function runScenario(context: vm.Context, outcomes: string[]) {
  const sandbox = context as vm.Context & { outcomes?: string[] };
  sandbox.outcomes = outcomes;

  const result = (await vm.runInContext(
    `
      (async () => {
        const products = outcomes.map((outcome, index) => ({ outcome, index }));
        try {
          const result = await processProductsInParallel(
            products,
            1,
            () => "",
            async (product) => {
              if (product.outcome === "challenge") {
                throw new AccessChallengeError("アクセス確認");
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

test("2商品連続でアクセス確認になった場合に停止する", async () => {
  const result = await runScenario(createWorkerContext(), ["challenge", "challenge"]);
  assert.deepEqual(result, {
    kind: "error",
    name: "Error",
    message: "駿河屋のアクセス確認が2商品連続で表示されたため、自動更新を停止しました。",
    succeeded: 0,
    failed: 2,
  });
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
