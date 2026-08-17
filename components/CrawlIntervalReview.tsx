"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./CrawlIntervalReview.module.css";

type ReviewProduct = {
  id: number;
  title: string;
  imageUrl: string | null;
  latestSalePrice: number | null;
  latestBuyPrice: number | null;
  manufacturer: string | null;
  releaseDate: string | null;
  stockStatus: string | null;
};

type CrawlIntervalValue = 1 | 3 | 7 | 14 | null;

type DecisionCounts = {
  one: number;
  three: number;
  seven: number;
  fourteen: number;
  off: number;
};

const OPTIONS: Array<{
  value: CrawlIntervalValue;
  label: string;
  detail: string;
  className: string;
  countKey: keyof DecisionCounts;
}> = [
  { value: 1, label: "1日のまま", detail: "毎日巡回", className: styles.one, countKey: "one" },
  { value: 3, label: "3日", detail: "3日に1回", className: styles.three, countKey: "three" },
  { value: 7, label: "7日", detail: "7日に1回", className: styles.seven, countKey: "seven" },
  { value: 14, label: "14日", detail: "14日に1回", className: styles.fourteen, countKey: "fourteen" },
  { value: null, label: "無", detail: "巡回しない", className: styles.off, countKey: "off" },
];

function formatPrice(value: number | null) {
  return value == null ? "未取得" : `${value.toLocaleString("ja-JP")}円`;
}

function formatReleaseDate(value: string | null) {
  return value ? value.replaceAll("-", "/") : "未登録";
}

function stockLabel(value: string | null) {
  if (value === "out_of_stock") return "在庫なし";
  if (value === "in_stock") return "在庫あり";
  return "在庫不明";
}

const EMPTY_COUNTS: DecisionCounts = {
  one: 0,
  three: 0,
  seven: 0,
  fourteen: 0,
  off: 0,
};

export function CrawlIntervalReview({ initialProducts }: { initialProducts: ReviewProduct[] }) {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<DecisionCounts>(EMPTY_COUNTS);

  const total = initialProducts.length;
  const current = initialProducts[index] ?? null;
  const done = index >= total;

  async function decide(option: (typeof OPTIONS)[number]) {
    if (!current || saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        option.value === 1
          ? `/api/products/${current.id}/crawl-review`
          : `/api/products/${current.id}/crawl-interval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(option.value === 1
            ? {}
            : { body: JSON.stringify({ crawlIntervalDays: option.value }) }),
        },
      );
      if (!response.ok) {
        throw new Error(
          option.value === 1
            ? "1日として確認済みにできませんでした。"
            : "巡回周期を保存できませんでした。",
        );
      }

      setCounts((previous) => ({
        ...previous,
        [option.countKey]: previous[option.countKey] + 1,
      }));
      setIndex((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "巡回周期を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  if (total === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.heading}>
          <div>
            <h1>巡回周期の振り分け</h1>
            <p>未確認の「1日」設定商品はありません。</p>
          </div>
        </header>
        <div className={`card ${styles.finished}`}>
          <strong>振り分け対象はありません。</strong>
          <Link className="button secondary" href="/products">商品一覧へ戻る</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.page}>
        <header className={styles.heading}>
          <div>
            <h1>巡回周期の振り分け</h1>
            <p>この画面を開いた時点で未確認だった「1日」商品をすべて確認しました。</p>
          </div>
        </header>
        <div className={`card ${styles.finished}`}>
          <strong>{total.toLocaleString("ja-JP")}件の振り分けが完了しました。</strong>
          <div className={styles.resultGrid}>
            <span>1日 {counts.one.toLocaleString("ja-JP")}件</span>
            <span>3日 {counts.three.toLocaleString("ja-JP")}件</span>
            <span>7日 {counts.seven.toLocaleString("ja-JP")}件</span>
            <span>14日 {counts.fourteen.toLocaleString("ja-JP")}件</span>
            <span>無 {counts.off.toLocaleString("ja-JP")}件</span>
          </div>
          <Link className="button secondary" href="/products">商品一覧へ戻る</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1>巡回周期の振り分け</h1>
          <p>未確認の「1日」設定商品を1件ずつ確認して、適切な周期へ振り分けます。</p>
        </div>
        <div className={styles.progressText}>
          <strong>{(index + 1).toLocaleString("ja-JP")} / {total.toLocaleString("ja-JP")}件目</strong>
          <span>残り {(total - index).toLocaleString("ja-JP")}件</span>
        </div>
      </header>

      <div className={styles.progressTrack} aria-hidden="true">
        <span style={{ width: `${(index / total) * 100}%` }} />
      </div>

      <article className={`card ${styles.reviewCard}`}>
        <div className={styles.imageArea}>
          {current.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={current.title} src={current.imageUrl} />
          ) : (
            <span className="muted">No Image</span>
          )}
        </div>

        <div className={styles.productInfo}>
          <div className={styles.currentBadge}>現在：1日</div>
          <h2>{current.title}</h2>
          <dl>
            <div><dt>ブランド</dt><dd>{current.manufacturer ?? "未登録"}</dd></div>
            <div><dt>発売日</dt><dd>{formatReleaseDate(current.releaseDate)}</dd></div>
            <div><dt>販売</dt><dd>{formatPrice(current.latestSalePrice)}</dd></div>
            <div><dt>買取</dt><dd>{formatPrice(current.latestBuyPrice)}</dd></div>
            <div><dt>在庫</dt><dd>{stockLabel(current.stockStatus)}</dd></div>
          </dl>
          <Link className={styles.detailLink} href={`/products/${current.id}`} target="_blank">
            商品詳細を別タブで開く
          </Link>
        </div>
      </article>

      <section className={`card ${styles.decisionPanel}`} aria-label="巡回周期を選択">
        <div>
          <strong>この商品の巡回周期</strong>
          <span>選ぶと保存して次の商品へ進みます。</span>
        </div>
        <div className={styles.options}>
          {OPTIONS.map((option) => (
            <button
              className={`${styles.optionButton} ${option.className}`}
              disabled={saving}
              key={option.label}
              onClick={() => void decide(option)}
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </div>
  );
}
