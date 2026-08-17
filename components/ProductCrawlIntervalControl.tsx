"use client";

import { useState } from "react";
import styles from "./ProductCrawlIntervalControl.module.css";

export type CrawlIntervalValue = 1 | 3 | 7 | 14 | null;

const OPTIONS: Array<{ value: CrawlIntervalValue; label: string; className: string }> = [
  { value: 1, label: "1日", className: styles.one },
  { value: 3, label: "3日", className: styles.three },
  { value: 7, label: "7日", className: styles.seven },
  { value: 14, label: "14日", className: styles.fourteen },
  { value: null, label: "無", className: styles.off },
];

function sameInterval(left: CrawlIntervalValue, right: CrawlIntervalValue) {
  return left === right;
}

export function ProductCrawlIntervalControl({
  productId,
  initialValue,
}: {
  productId: number;
  initialValue: CrawlIntervalValue;
}) {
  const [value, setValue] = useState<CrawlIntervalValue>(initialValue);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function apply(nextValue: CrawlIntervalValue) {
    if (saving || sameInterval(value, nextValue)) return;
    const previous = value;
    setValue(nextValue);
    setSaving(true);
    setStatus("変更中…");

    try {
      const response = await fetch(`/api/products/${productId}/crawl-interval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crawlIntervalDays: nextValue }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        crawlIntervalDays?: CrawlIntervalValue;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "巡回周期の変更に失敗しました。");
      setValue(result.crawlIntervalDays === undefined ? nextValue : result.crawlIntervalDays);
      setStatus(`${nextValue === null ? "無" : `${nextValue}日`}に変更しました`);
    } catch (error) {
      setValue(previous);
      setStatus(error instanceof Error ? error.message : "巡回周期の変更に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.panel} aria-label="この商品の巡回周期">
      <strong className={styles.label}>巡回周期</strong>
      <div className={styles.buttons} role="group" aria-label="巡回周期を変更">
        {OPTIONS.map((option) => {
          const selected = sameInterval(value, option.value);
          return (
            <button
              aria-pressed={selected}
              className={`${styles.button} ${selected ? option.className : ""}`}
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
      {status ? <span className={styles.status} role="status">{status}</span> : null}
    </section>
  );
}
