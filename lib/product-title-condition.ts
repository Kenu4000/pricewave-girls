const TRAILING_PARENTHETICAL = /(?:\(|（)([^()（）]+)(?:\)|）)\s*$/u;
const EXPLICIT_CONDITION_PREFIX = /^\s*状態\s*[:：]\s*(.+)$/u;
const CONDITION_KEYWORDS =
  /(?:欠品|欠損|不備|破損|汚れ|よごれ|ヤケ|焼け|変色|書き込み|シミ|カビ|割れ|ヒビ|剥がれ|剥げ|読み込み不良|動作不良|ジャンク|ディスクのみ|本体のみ|箱なし|説明書なし|ケースなし|帯なし|付属品なし|(?:ディスク|ケース|箱|ジャケット|盤面|本体)(?:傷|キズ)|(?:傷|キズ)(?:あり|有り|大|小|み))/u;

export type ParsedProductTitleCondition = {
  title: string;
  condition: string | null;
};

function conditionFromParenthetical(value: string): string | null {
  const trimmed = value.trim();
  const explicit = trimmed.match(EXPLICIT_CONDITION_PREFIX)?.[1]?.trim();
  if (explicit) return explicit;
  return CONDITION_KEYWORDS.test(trimmed) ? trimmed : null;
}

export function parseProductTitleCondition(title: string): ParsedProductTitleCondition {
  let remaining = title.trim();
  const conditions: string[] = [];

  while (remaining) {
    const match = remaining.match(TRAILING_PARENTHETICAL);
    if (!match || match.index === undefined) break;

    const condition = conditionFromParenthetical(match[1]);
    if (!condition) break;

    conditions.unshift(condition);
    remaining = remaining.slice(0, match.index).trimEnd();
  }

  return {
    title: remaining || title.trim(),
    condition: conditions.length > 0 ? conditions.join(" / ") : null,
  };
}

export function hasTrailingConditionAnnotation(title: string): boolean {
  return parseProductTitleCondition(title).condition !== null;
}

export function conditionAnnotatedProductIds(
  products: Array<{ id: number; title: string }>,
): number[] {
  return products
    .filter((product) => hasTrailingConditionAnnotation(product.title))
    .map((product) => product.id);
}
