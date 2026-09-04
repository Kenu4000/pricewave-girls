export const PRODUCT_CONDITION_DETAIL_KEY = "__pricewaveCondition";
export const PRODUCT_CONDITION_RANK_DETAIL_KEY = "__pricewaveConditionRank";

export type ProductConditionRank = "A" | "B";

export type ProductTitleCondition = {
  title: string;
  condition: string | null;
  conditionRank: ProductConditionRank;
};

const CONDITION_HINT =
  /(?:欠品|欠損|不足|不備|難あり|状態難|破損|汚れ|シミ|ヤケ|日焼け|変色|劣化|割れ|ヒビ|剥がれ|書き込み|折れ|凹み|へこみ|ディスクのみ|本体のみ|説明書なし|説明書無し|マニュアルなし|マニュアル無し|ケースなし|ケース無し|ジャケットなし|ジャケット無し|傷あり|キズあり|傷有|キズ有|ディスク傷|盤面傷|スレあり|擦れあり)/u;
const CONDITION_COMPONENT =
  "(?:ゲームディスク|インストールディスク|プレイディスク|ディスク|CD|DVD|FD|フロッピー|説明書|マニュアル|ケース|外箱|内箱|箱|ジャケット|本体|付属品|特典|冊子|カード|帯|シリアル)";
const COMPONENT_MISSING_HINT = new RegExp(
  `${CONDITION_COMPONENT}[^()（）]{0,16}(?:欠け|欠落)`,
  "u",
);
const COMPONENT_ONLY_HINT = new RegExp(
  `${CONDITION_COMPONENT}[^()（）]{0,80}のみ$`,
  "u",
);
const TRAILING_RANK_B_PATTERN = /^ランク\s*B$/iu;
const RANK_B_TITLE_MARKER = /(?:^|\s)(?:【\s*)?ランク\s*[BＢ](?:\s*】|\s*[)）])\s*/iu;

function normalizeConditionText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function isProductConditionText(value: string): boolean {
  const normalized = normalizeConditionText(value);
  if (!normalized) return false;
  return (
    TRAILING_RANK_B_PATTERN.test(normalized) ||
    CONDITION_HINT.test(normalized) ||
    COMPONENT_MISSING_HINT.test(normalized) ||
    COMPONENT_ONLY_HINT.test(normalized)
  );
}

export function splitProductTitleCondition(title: string): ProductTitleCondition {
  const trimmed = title.trim();
  const rankBMarker = RANK_B_TITLE_MARKER.exec(trimmed);
  if (rankBMarker && rankBMarker.index !== undefined) {
    const markerStart = rankBMarker.index;
    const leadingSpace = rankBMarker[0].match(/^\s/u)?.[0] ?? "";
    const markerContentStart = markerStart + leadingSpace.length;
    const markerEnd = markerStart + rankBMarker[0].length;
    const normalizedTitle = `${trimmed.slice(0, markerContentStart)}${trimmed.slice(markerEnd)}`
      .replace(/\s{2,}/gu, " ")
      .trim();
    return {
      title: normalizedTitle,
      condition: "ランクB",
      conditionRank: "B",
    };
  }

  for (const parenthetical of topLevelParentheticals(trimmed)) {
    const normalizedContent = normalizeConditionText(parenthetical.content);
    const explicit = parenthetical.content.match(/^\s*状態\s*[:：]\s*(.+)$/u);
    const condition = (
      TRAILING_RANK_B_PATTERN.test(normalizedContent)
        ? "ランクB"
        : explicit?.[1] ?? (isProductConditionText(parenthetical.content) ? parenthetical.content : "")
    ).trim();

    if (!condition) continue;

    return {
      // 状態括弧の後ろに「（Windows 10）」等のedition情報が続く場合も、それは残す。
      title: `${trimmed.slice(0, parenthetical.start)}${trimmed.slice(parenthetical.end)}`
        .replace(/\s{2,}/gu, " ")
        .trim(),
      condition,
      conditionRank: "B",
    };
  }

  return { title: trimmed, condition: null, conditionRank: "A" };
}

export function hasTrailingConditionAnnotation(title: string): boolean {
  // 互換のため関数名は維持するが、状態括弧の後ろに機種表記が続くケースも検出する。
  return splitProductTitleCondition(title).conditionRank === "B";
}

export function conditionAnnotatedProductIds(
  products: Array<{
    id: number;
    title: string;
    condition?: string | null;
    conditionRank?: string | null;
    detailsJson?: string | null;
  }>,
): number[] {
  return products
    .filter((product) => {
      if (product.conditionRank === "B" || product.condition) return true;
      if (hasTrailingConditionAnnotation(product.title)) return true;
      return conditionFromDetailsJson(product.detailsJson).conditionRank === "B";
    })
    .map((product) => product.id);
}

export function conditionUnannotatedProductIds(
  products: Array<{
    id: number;
    title: string;
    condition?: string | null;
    conditionRank?: string | null;
    detailsJson?: string | null;
  }>,
): number[] {
  const annotatedIds = new Set(conditionAnnotatedProductIds(products));
  return products
    .filter((product) => !annotatedIds.has(product.id))
    .map((product) => product.id);
}

export function productConditionFromDetails(details: Record<string, string>): {
  condition: string | null;
  conditionRank: ProductConditionRank;
} {
  const condition = details[PRODUCT_CONDITION_DETAIL_KEY]?.trim() || null;
  const storedRank = details[PRODUCT_CONDITION_RANK_DETAIL_KEY];
  return {
    condition,
    conditionRank: condition || storedRank === "B" ? "B" : "A",
  };
}

export function isInternalProductConditionDetailLabel(label: string): boolean {
  return label === PRODUCT_CONDITION_DETAIL_KEY || label === PRODUCT_CONDITION_RANK_DETAIL_KEY;
}

function conditionFromDetailsJson(detailsJson: string | null | undefined): {
  condition: string | null;
  conditionRank: ProductConditionRank;
} {
  if (!detailsJson) return { condition: null, conditionRank: "A" };
  try {
    const parsed = JSON.parse(detailsJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { condition: null, conditionRank: "A" };
    }
    const details = Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    return productConditionFromDetails(details);
  } catch {
    return { condition: null, conditionRank: "A" };
  }
}

type Parenthetical = {
  start: number;
  end: number;
  content: string;
};

function topLevelParentheticals(value: string): Parenthetical[] {
  const groups: Parenthetical[] = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(" || char === "（") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char !== ")" && char !== "）") continue;
    if (depth <= 0) continue;

    depth -= 1;
    if (depth === 0 && start >= 0) {
      groups.push({
        start,
        end: index + 1,
        content: value.slice(start + 1, index).trim(),
      });
      start = -1;
    }
  }

  return groups;
}
