"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./BrandCrawlIntervalBulk.module.css";

export type CrawlIntervalValue = 1 | 3 | 7 | 14 | null;

type BrandSummary = {
  label: string;
  count: number;
  uniform: boolean;
  crawlIntervalDays: CrawlIntervalValue;
};

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

export function BrandCrawlIntervalBulk() {
  const searchParams = useSearchParams();
  const brand = searchParams.get("brand")?.trim() ?? "";
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [value, setValue] = useState<CrawlIntervalValue | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!brand) {
      setSummary(null);
      setValue(undefined);
      setStatus("");
      return;
    }

    const controller = new AbortController();
    setSummary(null);
    setStatus("");
    void fetch(`/api/products/crawl-intervals/by-brand?brand=${encodeURIComponent(brand)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as BrandSummary & { error?: string };
        if (!response.ok) throw new Error(result.error || "ブランドの巡回周期を取得できませんでした。");
        setSummary(result);
        setValue(result.uniform ? result.crawlIntervalDays : undefined);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(error instanceof Error ? error.message : "ブランドの巡回周期を取得できませんでした。");
      });

    return () => controller.abort();
  }, [brand]);

  if (!brand) return null;
  if (!summary) {
    return status ? <p className={styles.status} role="status">{status}</p> : null;
  }

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

      const count = result.count ?? summary.count;
      setStatus(`${count}件を${nextValue === null ? "無" : `${nextValue}日`}に変更`);
      window.location.reload();
    } catch (error) {
      setValue(previous);
      setStatus(error instanceof Error ? error.message : "一括変更に失敗しました。");
      setSaving(false);
    }
  }

  return (
    <section className={`card ${styles.panel}`} aria-label={`${summary.label}の巡回周期一括変更`}>
      <div className={styles.copy}>
        <span className={styles.title}>{summary.label} の巡回周期を一括変更</span>
        <span className={styles.note}>このブランドの登録商品 {summary.count}件すべてに適用</span>
        {!summary.uniform && value === undefined ? (
          <span className={styles.note}>現在は商品ごとに異なる周期が設定されています。</span>
        ) : null}
        {status ? <span className={styles.status} role="status">{status}</span> : null}
      </div>
      <div className={styles.buttons} role="group" aria-label={`${summary.label}の巡回周期`}>
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
