"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearSmallPriceChangesButton() {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clearSmallChanges() {
    const confirmed = window.confirm(
      "価格差が300円以内の価格変更項目を一括削除します。商品と通常の価格履歴は削除されません。実際の小幅な価格変更も対象になります。",
    );
    if (!confirmed) return;

    setClearing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/price-changes/cleanup-small", {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as {
        deletedCount?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "価格変更項目を一括削除できませんでした");
      }

      const deletedCount = result.deletedCount ?? 0;
      setMessage(`${deletedCount.toLocaleString("ja-JP")}件削除しました`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "価格変更項目を一括削除できませんでした",
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
      <button
        disabled={clearing}
        onClick={clearSmallChanges}
        style={{
          background: "var(--danger)",
          fontSize: "0.82rem",
          padding: "8px 12px",
          whiteSpace: "nowrap",
        }}
        type="button"
      >
        {clearing ? "削除中" : "300円以内の変更を削除"}
      </button>
      {message ? (
        <span className="muted" style={{ fontSize: "0.72rem" }}>{message}</span>
      ) : null}
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: "0.72rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
