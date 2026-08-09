"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  nextProductRevealDelay,
  PRODUCT_REVEAL_EVENT,
  type ProductPreview,
} from "@/lib/product-preview";

type BatchEvent = {
  sessionId: string;
  products: ProductPreview[];
};

type QueuedProduct = {
  sessionId: string;
  product: ProductPreview;
};

export function LiveRefresh() {
  const router = useRouter();
  const queueRef = useRef<QueuedProduct[]>([]);
  const activeSessionRef = useRef<string | null>(null);
  const finishedSessionsRef = useRef(new Set<string>());
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/events");
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let connectedOnce = false;

    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };

    const finishIfDrained = (sessionId: string) => {
      const stillQueued = queueRef.current.some((item) => item.sessionId === sessionId);
      if (
        stillQueued ||
        activeSessionRef.current === sessionId ||
        !finishedSessionsRef.current.has(sessionId)
      ) {
        return;
      }

      // 各商品の保存時点で products-changed が発火しており、一覧はすでに最新化される。
      // 取込完了時に追加の再読込を行うと、更新中に見えていた並びを
      // サーバー描画結果で丸ごと置き換えてしまうため、完了時はセッション整理だけ行う。
      finishedSessionsRef.current.delete(sessionId);
    };

    const revealNext = () => {
      if (revealTimerRef.current || queueRef.current.length === 0) return;

      const next = queueRef.current.shift();
      if (!next) return;
      activeSessionRef.current = next.sessionId;
      const delay = nextProductRevealDelay();

      revealTimerRef.current = setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent<ProductPreview>(PRODUCT_REVEAL_EVENT, { detail: next.product }),
        );
        activeSessionRef.current = null;
        revealTimerRef.current = null;
        finishIfDrained(next.sessionId);
        revealNext();
      }, delay);
    };

    const receiveBatch = (message: MessageEvent<string>) => {
      try {
        const batch = JSON.parse(message.data) as BatchEvent;
        queueRef.current.push(
          ...batch.products.map((product) => ({
            sessionId: batch.sessionId,
            product,
          })),
        );
        revealNext();
      } catch {
        refresh();
      }
    };

    const receiveFinished = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as { sessionId: string };
        finishedSessionsRef.current.add(event.sessionId);
        finishIfDrained(event.sessionId);
      } catch {
        refresh();
      }
    };

    events.addEventListener("products-changed", refresh);
    events.addEventListener("products-batch", receiveBatch as EventListener);
    events.addEventListener("products-import-finished", receiveFinished as EventListener);
    events.addEventListener("open", () => {
      if (connectedOnce) refresh();
      connectedOnce = true;
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      events.close();
    };
  }, [router]);

  return null;
}
