import { type ProductSnapshotInput } from "@/lib/product-snapshots";
import { pruneProductPriceHistories } from "@/lib/price-history-retention";
import {
  notifyProductBatchSaved,
  notifyProductImportFinished,
} from "@/lib/product-events";
import { upsertProductSnapshotsWithTimeSale } from "@/lib/time-sale-persistence";

const AUTO_FLUSH_SIZE = 100;
const SESSION_TTL_MS = 2 * 60 * 60 * 1_000;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type ImportSession = {
  id: string;
  createdAt: number;
  pending: Map<string, ProductSnapshotInput>;
  knownUrls: Set<string>;
  savedIds: number[];
  flushPromise?: Promise<void>;
  flushError?: unknown;
  finalizingPromise?: Promise<number[]>;
  completedIds?: number[];
};

const globalForImportSessions = globalThis as unknown as {
  productImportSessionsV2?: Map<string, ImportSession>;
};

const sessions =
  globalForImportSessions.productImportSessionsV2 ?? new Map<string, ImportSession>();

if (process.env.NODE_ENV !== "production") {
  globalForImportSessions.productImportSessionsV2 = sessions;
}

function validateSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("取込セッションIDが不正です");
  }
}

function deleteExpiredSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (
      !session.flushPromise &&
      !session.finalizingPromise &&
      now - session.createdAt >= SESSION_TTL_MS
    ) {
      sessions.delete(sessionId);
    }
  }
}

function takePendingItems(session: ImportSession, count: number) {
  const items: ProductSnapshotInput[] = [];
  for (const [url, input] of session.pending) {
    items.push(input);
    session.pending.delete(url);
    if (items.length >= count) break;
  }
  return items;
}

function flushNextBatch(session: ImportSession, force: boolean) {
  if (session.flushPromise) return session.flushPromise;
  if (session.flushError) return undefined;

  const flushCount = force
    ? Math.min(AUTO_FLUSH_SIZE, session.pending.size)
    : session.pending.size >= AUTO_FLUSH_SIZE
      ? AUTO_FLUSH_SIZE
      : 0;
  if (flushCount === 0) return undefined;

  const batch = takePendingItems(session, flushCount);
  const flushPromise = upsertProductSnapshotsWithTimeSale(batch, { notify: false })
    .then(async (products) => {
      await pruneProductPriceHistories(products.map((product) => product.id));
      session.savedIds.push(...products.map((product) => product.id));
      notifyProductBatchSaved(
        session.id,
        session.savedIds.length,
        products,
      );
    })
    .catch((error) => {
      for (const input of batch) {
        session.pending.set(input.surugayaUrl, input);
      }
      session.flushError = error;
    })
    .finally(() => {
      session.flushPromise = undefined;
      if (!session.flushError && session.pending.size >= AUTO_FLUSH_SIZE) {
        void flushNextBatch(session, false);
      }
    });

  session.flushPromise = flushPromise;
  return flushPromise;
}

export async function stageProductSnapshot(
  sessionId: string,
  input: ProductSnapshotInput,
) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = sessions.get(sessionId) ?? {
    id: sessionId,
    createdAt: Date.now(),
    pending: new Map<string, ProductSnapshotInput>(),
    knownUrls: new Set<string>(),
    savedIds: [],
  };
  if (session.finalizingPromise || session.completedIds) {
    throw new Error("確定処理を開始した取込セッションには追加できません");
  }

  if (!session.knownUrls.has(input.surugayaUrl)) {
    session.knownUrls.add(input.surugayaUrl);
    session.pending.set(input.surugayaUrl, input);
  }
  sessions.set(sessionId, session);

  const flushPromise = flushNextBatch(session, false);
  if (flushPromise) await flushPromise;

  return session.knownUrls.size;
}

export async function commitProductImportSession(sessionId: string) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = sessions.get(sessionId);
  if (!session) return [];
  if (session.completedIds) return session.completedIds;
  if (session.finalizingPromise) return session.finalizingPromise;

  const finalize = async () => {
    if (session.flushPromise) await session.flushPromise;

    // A failed 100-item write is atomic and remains in pending, so the final
    // commit can safely retry it once through requestLocal's normal retry path.
    session.flushError = undefined;

    while (session.pending.size > 0) {
      const flushPromise = flushNextBatch(session, true);
      if (!flushPromise) {
        throw session.flushError ?? new Error("一括保存を開始できませんでした");
      }
      await flushPromise;
      if (session.flushError) throw session.flushError;
    }

    session.completedIds = [...session.savedIds];
    notifyProductImportFinished(session.id, session.completedIds.length);
    return session.completedIds;
  };

  session.finalizingPromise = finalize()
    .then((ids) => {
      session.finalizingPromise = undefined;
      return ids;
    })
    .catch((error) => {
      session.finalizingPromise = undefined;
      throw error;
    });
  return session.finalizingPromise;
}
