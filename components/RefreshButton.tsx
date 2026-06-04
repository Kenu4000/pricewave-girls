"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton({ productId }: { productId: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refresh() {
    setMessage(null);
    setError(null);
    setIsRefreshing(true);

    try {
      const response = await fetch(`/api/refresh/${productId}`, { method: "POST" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "更新に失敗しました");
      }

      setMessage("最新価格を保存しました。");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新に失敗しました");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="form">
      <button disabled={isRefreshing} onClick={refresh} type="button">
        {isRefreshing ? "更新中..." : "手動更新"}
      </button>
      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}
    </div>
  );
}
