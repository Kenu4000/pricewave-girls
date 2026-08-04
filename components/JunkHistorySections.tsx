"use client";

import { useMemo, useState } from "react";
import {
  buildJunkHistoryViewSections,
  countJunkHistoryItems,
  type JunkHistoryViewGroup,
  type JunkHistoryViewItem,
} from "@/lib/junk-history-view";
import styles from "./JunkHistorySections.module.css";

type SortDirection = "asc" | "desc";

type JunkHistorySectionsProps = {
  items: JunkHistoryViewItem[];
  latestSnapshotAt: string | null;
};

export function JunkHistorySections({
  items,
  latestSnapshotAt,
}: JunkHistorySectionsProps) {
  const sections = useMemo(
    () => buildJunkHistoryViewSections(items, latestSnapshotAt),
    [items, latestSnapshotAt],
  );
  const currentCount = countJunkHistoryItems(sections.current);
  const pastCount = countJunkHistoryItems(sections.past);

  return (
    <section className={`card ${styles.panel}`}>
      <div className={styles.summary}>
        <h2>ジャンク・他ショップ履歴</h2>
        <span className="muted">
          {(currentCount + pastCount).toLocaleString("ja-JP")}件
        </span>
      </div>

      <div className={styles.sections}>
        <HistorySection
          emptyMessage="現在販売中として取得できた状態違い・他ショップ商品はありません。"
          groups={sections.current}
          title="販売中"
        />
        <HistorySection
          emptyMessage="重複を除いた過去データはありません。"
          groups={sections.past}
          title="過去データ"
        />
      </div>
    </section>
  );
}

function HistorySection({
  title,
  groups,
  emptyMessage,
}: {
  title: string;
  groups: JunkHistoryViewGroup[];
  emptyMessage: string;
}) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const sortedGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) =>
          compareHistoryItems(left, right, sortDirection),
        ),
      })),
    [groups, sortDirection],
  );
  const count = countJunkHistoryItems(groups);

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
        <span className="muted">{count.toLocaleString("ja-JP")}件</span>
      </div>

      {count > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>確認日時</th>
                <th>種別</th>
                <th>店舗名</th>
                <th aria-sort={sortDirection === "asc" ? "ascending" : "descending"}>
                  <button
                    className={styles.sortButton}
                    onClick={() =>
                      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                    }
                    type="button"
                  >
                    状態
                    <span aria-hidden="true">{sortDirection === "asc" ? "▲" : "▼"}</span>
                  </button>
                </th>
                <th>価格</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.flatMap((group) =>
                group.items.map((item, index) => {
                  const isLastInCapture = index === group.items.length - 1;
                  return (
                    <tr className={isLastInCapture ? styles.groupEnd : undefined} key={item.id}>
                      <td className={styles.dateCell}>
                        {isLastInCapture ? formatDateTime(group.checkedAt) : ""}
                      </td>
                      <td className={styles.sourceCell}>{formatSource(item.sourceType)}</td>
                      <td className={styles.storeCell}>{item.storeName ?? "—"}</td>
                      <td className={styles.conditionCell}>{item.condition}</td>
                      <td className={styles.priceCell}>{formatPrice(item.price)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}
    </section>
  );
}

function compareHistoryItems(
  left: JunkHistoryViewItem,
  right: JunkHistoryViewItem,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  const conditionDifference = left.condition.localeCompare(right.condition, "ja", {
    numeric: true,
    sensitivity: "base",
  });
  if (conditionDifference !== 0) return conditionDifference * multiplier;

  const storeDifference = (left.storeName ?? "").localeCompare(right.storeName ?? "", "ja", {
    numeric: true,
    sensitivity: "base",
  });
  if (storeDifference !== 0) return storeDifference * multiplier;

  return (left.price - right.price) * multiplier;
}

function formatSource(sourceType: string): string {
  return sourceType === "other_shop" ? "他ショップ" : "状態違い";
}

function formatPrice(price: number): string {
  return `${price.toLocaleString("ja-JP")}円`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ja-JP");
}
