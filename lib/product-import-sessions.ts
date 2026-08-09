import { type ProductSnapshotInput } from "@/lib/product-snapshots";
import { productImportQueue } from "@/lib/product-import-queue";
import {
  notifyProductBatchSaved,
  notifyProductImportFinished,
} from "@/lib/product-events";

const SESSION_TTL_MS = 2 * 60 * 60 * 1_000;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type ImportSession = {
  id: string;
  createdAt: number;
  lastTouchedAt: number;
  knownUrls: Set<string>;
  savedIds: number[];
  finalizingPromise?: Promise<number[]>;
  completedIds?: number[];
};

const globalForImportSessions = globalThis as unknown as {
  productImportSessionsV3?: Map<string, ImportSession>;
};

const sessions =
  globalForImportSessions.productImportSessionsV3 ?? new Map<string, ImportSession>();

// /api/import と /api/import/commit は別Route Moduleとして読み込まれるため、
// 開発・本番を問わず同じNodeプロセス内ではセッションをglobalThisで共有する。
globalForImportSessions.productImportSessionsV3 = sessions;

function validateSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("取込セッションIDが不正です");
  }
}

function deleteExpiredSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (
      !session.finalizingPromise &&
      now - session.lastTouchedAt >= SESSION_TTL_MS
    ) {
      sessions.delete(sessionId);
    }
  }
}

function getOrCreateSession(sessionId: string) {
  const now = Date.now();
  const existing = sessions.get(sessionId);
  if (existing) {
    existing.lastTouchedAt = now;
    return existing;
  }

  const session: ImportSession = {
    id: sessionId,
    createdAt: now,
    lastTouchedAt: now,
    knownUrls: new Set<string>(),
    savedIds: [],
  };
  sessions.set(sessionId, session);
  return session;
}

export async function stageProductSnapshot(
  sessionId: string,
  input: ProductSnapshotInput,
) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = getOrCreateSession(sessionId);
  if (session.finalizingPromise || session.completedIds) {
    throw new Error("確定処理を開始した取込セッションには追加できません");
  }

  if (session.knownUrls.has(input.surugayaUrl)) {
    return session.knownUrls.size;
  }

  session.knownUrls.add(input.surugayaUrl);
  session.lastTouchedAt = Date.now();

  try {
    // 自動更新も手動記録と同じAsyncBatcherでPriceHistoryまで確定保存する。
    // 通知には実際の確認時刻も載せ、並列保存の完了順ではなく
    // PriceHistory.checkedAt の順で一覧を維持する。
    const product = await productImportQueue.enqueue(input, { notify: false });
    session.savedIds.push(product.id);
    session.lastTouchedAt = Date.now();
    notifyProductBatchSaved(session.id, session.savedIds.length, [
      {
        ...product,
        lastCheckedAt: (input.checkedAt ?? new Date()).toISOString(),
      },
    ]);
    return session.knownUrls.size;
  } catch (error) {
    // 同じ商品を再試行できるよう、保存失敗時だけ既知URLから戻す。
    session.knownUrls.delete(input.surugayaUrl);
    session.lastTouchedAt = Date.now();
    throw error;
  }
}

export async function commitProductImportSession(sessionId: string) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = sessions.get(sessionId);
  if (!session) return [];
  if (session.completedIds) return session.completedIds;
  if (session.finalizingPromise) return session.finalizingPromise;

  const finalize = async () => {
    // 各 /api/import は productImportQueue.enqueue() の完了を待ってから応答する。
    // したがって、この時点の savedIds はすべてDB保存済み。
    session.completedIds = [...session.savedIds];
    session.lastTouchedAt = Date.now();
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
