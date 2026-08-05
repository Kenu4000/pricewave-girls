"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePriceChangeButton({
  priceChangeId,
}: {
  priceChangeId: number;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deletePriceChange() {
    const confirmed = window.confirm(
      "この価格変更項目だけを削除します。商品と価格履歴は削除されません。",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/price-changes/${priceChangeId}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "価格変更項目を削除できませんでした");
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "価格変更項目を削除できませんでした",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      <button
        aria-label="この価格変更項目を削除"
        disabled={deleting}
        onClick={deletePriceChange}
        style={{
          background: "var(--danger)",
          fontSize: "0.78rem",
          padding: "7px 11px",
          whiteSpace: "nowrap",
        }}
        type="button"
      >
        {deleting ? "削除中" : "削除"}
      </button>
      {error ? (
        <span role="alert" style={{ color: "var(--danger)", fontSize: "0.72rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
