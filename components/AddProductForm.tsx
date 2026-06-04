"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AddProductForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const result = (await response.json()) as { id?: number; error?: string };

      if (!response.ok || !result.id) {
        throw new Error(result.error ?? "商品の追加に失敗しました");
      }

      router.push(`/products/${result.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "商品の追加に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <label>
        <span className="product-title">駿河屋の商品URL</span>
        <input
          className="input"
          name="url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.suruga-ya.jp/product/detail/..."
          required
          type="url"
          value={url}
        />
      </label>
      <p className="muted">
        登録時にページを取得して、商品名・画像URL・販売価格・買取価格・在庫状態を記録します。
      </p>
      {error ? <div className="alert error">{error}</div> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "取得中..." : "商品を追加"}
      </button>
    </form>
  );
}
