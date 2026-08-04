import {
  upsertProductSnapshots,
  type ProductSnapshotInput,
} from "@/lib/product-snapshots";

const SESSION_TTL_MS = 2 * 60 * 60 * 1_000;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type ImportSession = {
  createdAt: number;
  items: Map<string, ProductSnapshotInput>;
  commitPromise?: Promise<number[]>;
  completedIds?: number[];
};

const globalForImportSessions = globalThis as unknown as {
  productImportSessions?: Map<string, ImportSession>;
};

const sessions = globalForImportSessions.productImportSessions ?? new Map<string, ImportSession>();

if (process.env.NODE_ENV !== "production") {
  globalForImportSessions.productImportSessions = sessions;
}

function validateSessionId(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("取込セッションIDが不正です");
  }
}

function deleteExpiredSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (!session.commitPromise && now - session.createdAt >= SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

export function stageProductSnapshot(sessionId: string, input: ProductSnapshotInput) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = sessions.get(sessionId) ?? {
    createdAt: Date.now(),
    items: new Map<string, ProductSnapshotInput>(),
  };
  if (session.commitPromise || session.completedIds) {
    throw new Error("確定処理を開始した取込セッションには追加できません");
  }

  session.items.set(input.surugayaUrl, input);
  sessions.set(sessionId, session);
  return session.items.size;
}

export async function commitProductImportSession(sessionId: string) {
  validateSessionId(sessionId);
  deleteExpiredSessions();

  const session = sessions.get(sessionId);
  if (!session) return [];
  if (session.completedIds) return session.completedIds;
  if (session.commitPromise) return session.commitPromise;

  session.commitPromise = upsertProductSnapshots([...session.items.values()])
    .then((products) => {
      session.completedIds = products.map((product) => product.id);
      session.items.clear();
      session.commitPromise = undefined;
      return session.completedIds;
    })
    .catch((error) => {
      session.commitPromise = undefined;
      throw error;
    });

  return session.commitPromise;
}
