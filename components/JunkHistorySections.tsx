"use client";

import { useMemo, useState } from "react";
import {
  buildJunkHistoryViewSections,
  countJunkHistoryItems,
  filterJunkHistoryGroupsByCondition,
  listJunkHistoryConditions,
  type JunkHistoryViewGroup,
  type JunkHistoryViewItem,
} from "@/lib/junk-history-view";
import styles from "./JunkHistorySections.module.css";

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
  const [conditionFilter, setConditionFilter] = useState("");
  const conditionOptions = useMemo(() => listJunkHistoryConditions(groups), [groups]);
  const filteredGroups = useMemo(
    () => filterJunkHistoryGroupsByCondition(groups, conditionFilter),
    [groups, conditionFilter],
  );
  const totalCount = countJunkHistoryItems(groups);
  const filteredCount = countJunkHistoryItems(filteredGroups);

  return (
    <section>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <h3>{title}</h3>
          <span className="muted">
            {conditionFilter
              ? `${filteredCount.toLocaleString("ja-JP")} / ${totalCount.toLocaleString("ja-JP")}件`
              : `${totalCount.toLocaleString("ja-JP")}件`}
          </span>
        </div>

        {conditionOptions.length > 0 ? (
          <label className={styles.filterControl}>
            <span>状態で絞り込み</span>
            <select
              onChange={(event) => setConditionFilter(event.target.value)}
              value={conditionFilter}
            >
              <option value="">すべての状態</option>
              {conditionOptions.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filteredCount > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>確認日時</th>
                <th>種別</th>
                <th>店舗名</th>
                <th>状態</th>
                <th>価格</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.flatMap((group) =>
                group.items.map((item, index) => {
                  const isFirstInCapture = index === 0;
                  const isLastInCapture = index === group.items.length - 1;
                  return (
                    <tr className={isLastInCapture ? styles.groupEnd : undefined} key={item.id}>
                      <td className={styles.dateCell}>
                        {isFirstInCapture ? formatDateTime(group.checkedAt) : ""}
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
        <p className={styles.empty}>
          {conditionFilter ? "選択した状態に該当するデータはありません。" : emptyMessage}
        </p>
      )}
    </section>
  );
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
