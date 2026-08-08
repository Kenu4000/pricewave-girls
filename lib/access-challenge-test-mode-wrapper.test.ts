import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const wrapperSource = readFileSync(
  new URL("../browser-extension/access-challenge-test-mode-wrapper.js", import.meta.url),
  "utf8",
);

type TestContext = vm.Context & {
  storageData: Record<string, unknown>;
  outcomes?: string[];
};

function createContext(testMode = true): TestContext {
  const storageData: Record<string, unknown> = {
    continueThroughAccessChallenges: testMode,
  };
  const context = vm.createContext({ storageData }) as TestContext;

  context.chrome = {
    storage: {
      local: {
        async get(keys: unknown) {
          if (keys && typeof keys === "object" && !Array.isArray(keys)) {
            const defaults = keys as Record<string, unknown>;
            return Object.fromEntries(
              Object.entries(defaults).map(([key, fallback]) => [
                key,
                Object.prototype.hasOwnProperty.call(storageData, key)
                  ? storageData[key]
                  : fallback,
              ]),
            );
          }
          return { ...storageData };
        },
      },
    },
  };

  vm.runInContext(
    `
      const UPDATE_INTERVAL_MS = 1_000;
      class AccessChallengeError extends Error {}
      async function updateOneProduct() {}
      async function setStatus() {}
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
    { filename: "test-worker-base.js" },
  );
  vm.runInContext(wrapperSource, context, {
    filename: "access-challenge-test-mode-wrapper.js",
  });
  return context;
}

async function runScenario(context: TestContext, outcomes: string[]) {
  context.outcomes = outcomes;
  const result = await vm.runInContext(
    `
      (async () => {
        const products = outcomes.map((outcome, index) => ({ outcome, index }));
        try {
          const result = await processProductsInParallel(
            products,
            10,
            () => "",
            async (product) => {
              if (product.outcome === "challenge" || product.outcome === "hard-block") {
                const error = new AccessChallengeError("アクセス確認");
                if (product.outcome === "hard-block") {
                  error.nonSkippable = true;
                  error.httpStatus = 403;
                }
                throw error;
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
            nonSkippable: error.nonSkippable,
          };
        }
      })()
    `,
    context,
  );
  return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
}

test("強制テストモードではアクセス確認が何件連続しても停止しない", async () => {
  const result = await runScenario(createContext(true), [
    "challenge",
    "challenge",
    "challenge",
    "success",
  ]);
  assert.deepEqual(result, {
    kind: "result",
    succeeded: 1,
    failed: 3,
  });
});

test("強制テストモードでは実HTTP 403・429相当も失敗扱いで最後まで進む", async () => {
  const result = await runScenario(createContext(true), ["challenge", "hard-block", "success"]);
  assert.deepEqual(result, {
    kind: "result",
    succeeded: 1,
    failed: 2,
  });
});

test("テストモードOFFでは通常のアクセス確認停止を変更しない", async () => {
  const result = await runScenario(createContext(false), ["challenge", "success"]);
  assert.equal(result.kind, "error");
  assert.equal(result.failed, 1);
});
