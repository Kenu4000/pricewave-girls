export type JunkHistoryViewItem = {
  id: number;
  sourceType: string;
  storeName: string | null;
  condition: string;
  price: number;
  checkedAt: string;
};

export type JunkHistoryViewGroup = {
  key: string;
  checkedAt: string;
  items: JunkHistoryViewItem[];
};

export type JunkHistoryViewSections = {
  current: JunkHistoryViewGroup[];
  past: JunkHistoryViewGroup[];
};

const CURRENT_SNAPSHOT_TOLERANCE_MS = 30_000;

export function buildJunkHistoryViewSections(
  items: JunkHistoryViewItem[],
  latestSnapshotAt: string | null,
): JunkHistoryViewSections {
  const groups = groupByCaptureTime(items);
  const currentGroup = findCurrentGroup(groups, latestSnapshotAt);
  const seen = new Set<string>();

  const current = currentGroup
    ? [filterUniqueItems(currentGroup, seen)]
        .filter((group): group is JunkHistoryViewGroup => group.items.length > 0)
    : [];

  const past = groups
    .filter((group) => group.key !== currentGroup?.key)
    .map((group) => filterUniqueItems(group, seen))
    .filter((group) => group.items.length > 0);

  return { current, past };
}

export function countJunkHistoryItems(groups: JunkHistoryViewGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

export function listJunkHistoryConditions(groups: JunkHistoryViewGroup[]): string[] {
  const conditions = new Map<string, string>();

  for (const group of groups) {
    for (const item of group.items) {
      const key = normalizeIdentityText(item.condition);
      if (!conditions.has(key)) {
        conditions.set(key, normalizeConditionDisplay(item.condition));
      }
    }
  }

  return [...conditions.values()].sort((left, right) =>
    left.localeCompare(right, "ja", { numeric: true, sensitivity: "base" }),
  );
}

export function filterJunkHistoryGroupsByCondition(
  groups: JunkHistoryViewGroup[],
  condition: string,
): JunkHistoryViewGroup[] {
  const conditionKey = normalizeIdentityText(condition);
  if (!conditionKey) return groups;

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => normalizeIdentityText(item.condition) === conditionKey,
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function groupByCaptureTime(items: JunkHistoryViewItem[]): JunkHistoryViewGroup[] {
  const groups = new Map<string, JunkHistoryViewGroup>();
  const orderedItems = [...items].sort((left, right) => {
    const dateDifference = dateValue(right.checkedAt) - dateValue(left.checkedAt);
    return dateDifference || right.id - left.id;
  });

  for (const item of orderedItems) {
    const second = Math.floor(dateValue(item.checkedAt) / 1_000);
    const key = Number.isFinite(second) ? String(second) : `invalid-${item.id}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
      if (dateValue(item.checkedAt) > dateValue(group.checkedAt)) {
        group.checkedAt = item.checkedAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      checkedAt: item.checkedAt,
      items: [item],
    });
  }

  return [...groups.values()].sort(
    (left, right) => dateValue(right.checkedAt) - dateValue(left.checkedAt),
  );
}

function findCurrentGroup(
  groups: JunkHistoryViewGroup[],
  latestSnapshotAt: string | null,
): JunkHistoryViewGroup | null {
  if (!latestSnapshotAt || groups.length === 0) return null;

  const snapshotTime = dateValue(latestSnapshotAt);
  if (!Number.isFinite(snapshotTime)) return null;

  let closest: JunkHistoryViewGroup | null = null;
  let closestDifference = Number.POSITIVE_INFINITY;

  for (const group of groups) {
    const difference = Math.abs(dateValue(group.checkedAt) - snapshotTime);
    if (difference < closestDifference) {
      closest = group;
      closestDifference = difference;
    }
  }

  return closestDifference <= CURRENT_SNAPSHOT_TOLERANCE_MS ? closest : null;
}

function filterUniqueItems(
  group: JunkHistoryViewGroup,
  seen: Set<string>,
): JunkHistoryViewGroup {
  const uniqueItems = group.items.filter((item) => {
    const key = itemIdentity(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ...group, items: uniqueItems };
}

function itemIdentity(item: JunkHistoryViewItem): string {
  return [
    normalizeIdentityText(item.sourceType),
    normalizeIdentityText(item.storeName ?? ""),
    normalizeIdentityText(item.condition),
    String(item.price),
  ].join("\u0000");
}

function normalizeConditionDisplay(value: string): string {
  return value.replace(/[\u00a0\u3000]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeIdentityText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/g, "").trim();
}

function dateValue(value: string): number {
  return new Date(value).getTime();
}
