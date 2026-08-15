"use client";

import { useState } from "react";
import styles from "./BrandCrawlIntervalBulk.module.css";

export type CrawlIntervalValue = 1 | 3 | 7 | 14 | null;

const OPTIONS: Array<{ value: CrawlIntervalValue; label: string }> = [
  { value: 1, label: "1日" },
  { value: 3, label: "3日" },
  { value: 7, label: "7日" },
  { value: 14, label: "14日" },
  { value: null, label: "無" },
];

function activeClass(value: CrawlIntervalValue): string {
  if (value === 1) return styles.one;
  if (value === 3) return styles.three;
  if (value === 7) return styles.seven;
  if (value === 14) return styles.fourteen;
  return styles.off;
}

export function BrandCrawlIntervalBulk({
  brand,
  brandLabel,
  productCount,
  initialValue,
}: {
  brand: string;
  brandLabel: string;
  productCount: number;
  initialValue?: CrawlIntervalValue;
}) {
  const [value, setValue] = useState<CrawlIntervalValue | undefined>(initialValue);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function apply(nextValue: CrawlIntervalValue) {
    if (saving) return;
    const previous = value;
    setValue(nextValue);
    setSaving(true);
    setStatus("変更中…");

    try {
      const response = await fetch("/api/products/crawl-intervals/by-brand", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, crawlIntervalDays: nextValue }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        count?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "一括変更に失敗しました。");

      const count = result.count ?? productCount;
      setStatus(`${count}件を${nextValue === null ? "無" : `${nextValue}日`}に変更`);
      window.location.reload();
    } catch (error) {
      setValue(previous);
      setStatus(error instanceof Error ? error.message : "一括変更に失敗しました。");
      setSaving(false);
    }
  }

  return (
    <section className={`card ${styles.panel}`} aria-label={`${brandLabel}の巡回周期一括変更`}>
      <div className={styles.copy}>
        <span className={styles.title}>{brandLabel} の巡回周期を一括変更</span>
        <span className={styles.note}>このブランドの登録商品 {productCount}件すべてに適用</span>
        {status ? <span className={styles.status} role="status">{status}</span> : null}
      </div>
      <div className={styles.buttons} role="group" aria-label={`${brandLabel}の巡回周期`}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              aria-pressed={selected}
              className={`${styles.button} ${selected ? activeClass(option.value) : ""}`}
              disabled={saving}
              key={option.label}
              onClick={() => void apply(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
