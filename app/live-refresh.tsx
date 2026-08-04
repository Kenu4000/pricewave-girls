"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ProductPreview = {
  id: number;
  title: string;
  imageUrl: string | null;
  salePrice: number | null;
  buyPrice: number | null;
};

type BatchEvent = {
  sessionId: string;
  savedCount: number;
  products: ProductPreview[];
};

type QueuedProduct = {
  sessionId: string;
  displayCount: number;
  savedCount: number;
  product: ProductPreview;
};

type ImportActivity = {
  sessionId: string;
  displayCount: number;
  savedCount: number;
  recentProducts: ProductPreview[];
  finished: boolean;
};

function formatPrice(price: number | null) {
  return price === null ? "未取得" : `${price.toLocaleString("ja-JP")}円`;
}

export function LiveRefresh() {
  const router = useRouter();
  const [activity, setActivity] = useState<ImportActivity | null>(null);
  const queueRef = useRef<QueuedProduct[]>([]);
  const activeSessionRef = useRef<string | null>(null);
  const finishedSessionsRef = useRef(new Set<string>());
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      setActivity((current) =>
        current?.sessionId === sessionId ? { ...current, finished: true } : current,
      );
      finishTimerRef.current = setTimeout(() => {
        refresh();
        setActivity((current) => (current?.sessionId === sessionId ? null : current));
        finishedSessionsRef.current.delete(sessionId);
      }, 900);
    };

    const revealNext = () => {
      if (revealTimerRef.current || queueRef.current.length === 0) return;

      const next = queueRef.current.shift();
      if (!next) return;
      activeSessionRef.current = next.sessionId;
      const delay = 70 + Math.floor(Math.random() * 151);

      revealTimerRef.current = setTimeout(() => {
        setActivity((current) => ({
          sessionId: next.sessionId,
          displayCount: next.displayCount,
          savedCount: Math.max(
            current?.sessionId === next.sessionId ? current.savedCount : 0,
            next.savedCount,
          ),
          recentProducts: [
            next.product,
            ...(current?.sessionId === next.sessionId ? current.recentProducts : []),
          ].slice(0, 5),
          finished: false,
        }));
        activeSessionRef.current = null;
        revealTimerRef.current = null;
        finishIfDrained(next.sessionId);
        revealNext();
      }, delay);
    };

    const receiveBatch = (message: MessageEvent<string>) => {
      try {
        const batch = JSON.parse(message.data) as BatchEvent;
        const firstCount = batch.savedCount - batch.products.length;
        queueRef.current.push(
          ...batch.products.map((product, index) => ({
            sessionId: batch.sessionId,
            displayCount: firstCount + index + 1,
            savedCount: batch.savedCount,
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
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      events.close();
    };
  }, [router]);

  if (!activity) return null;

  return (
    <aside aria-live="polite" className="import-activity">
      <div className="import-activity-heading">
        <div>
          <strong>{activity.finished ? "反映完了" : "商品を順番に反映中"}</strong>
          <span>
            表示 {activity.displayCount.toLocaleString("ja-JP")}件 / 保存済み{" "}
            {activity.savedCount.toLocaleString("ja-JP")}件
          </span>
        </div>
        <span className={`import-pulse ${activity.finished ? "finished" : ""}`} />
      </div>
      <div className="import-activity-list">
        {activity.recentProducts.map((product) => (
          <a className="import-activity-item" href={`/products/${product.id}`} key={product.id}>
            <div className="import-activity-image">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={product.imageUrl} />
              ) : (
                <span>No Image</span>
              )}
            </div>
            <div>
              <strong>{product.title}</strong>
              <span>
                販売 {formatPrice(product.salePrice)}・買取 {formatPrice(product.buyPrice)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}
