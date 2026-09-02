export type BrandIdentity = {
  key: string;
  label: string;
};

const BRAND_ALIAS_GROUPS = [
  ["ALICESOFT", "ALICESOFT（アリスソフト）", "ALICESOFT", "AliceSoft", "アリスソフト", "ありすそふと"],
  ["戯画", "戯画（GIGA）", "戯画", "GIGA", "Giga"],
  ["FrontWing", "FrontWing（フロントウィング）", "FrontWing", "フロントウィング", "フロントウイング"],
  ["NitroPlus", "NitroPlus（ニトロプラス）", "NitroPlus", "Nitro+", "ニトロプラス"],
  ["Purple software", "Purple software（パープルソフトウェア）", "Purple software", "パープルソフトウェア"],
  ["ぱれっと", "ぱれっと", "ぱれっと", "パレット", "Palette", "PALETTE"],
  ["Leaf", "Leaf", "Leaf", "LEAF", "リーフ", "AQUAPLUS", "AQUAPLUS（アクアプラス）", "アクアプラス"],
  ["あかべぇそふとつぅ", "あかべぇそふとつぅ", "あかべぇそふとつぅ", "AKABEi SOFT2", "AKABEiSOFT2", "AiNO", "AINO"],
  ["Liar-soft", "Liar-soft（ライアーソフト）", "Liar-soft", "ライアーソフト"],
  ["Escu:de", "Escu:de（エスクード）", "Escu:de", "エスクード"],
  ["Overflow", "Overflow（オーバーフロー）", "Overflow", "オーバーフロー"],
  ["BLUE GALE", "BLUE GALE（ブルーゲイル）", "BLUE GALE", "ブルーゲイル"],
  ["FlyingShine", "FlyingShine（フライングシャイン）", "FlyingShine", "フライングシャイン"],
  ["UNiSONSHIFT", "UNiSONSHIFT（ユニゾンシフト）", "UNiSONSHIFT", "ユニゾンシフト"],
  ["MAGES.", "MAGES.（5pb.）", "MAGES.", "MAGES.(5pb.)", "5pb.", "5pb"],
  ["CandySoft", "CandySoft（きゃんでぃそふと）", "CandySoft", "きゃんでぃそふと"],
  ["D.O.", "D.O.（ディーオー）", "D.O.", "ディーオー"],
  ["HOOKSOFT", "HOOKSOFT（HOOK）", "HOOKSOFT", "HOOK"],
  ["âge", "âge（age）", "âge", "age", "aNTIQ", "ANTIQ"],
  [
    "F&C",
    "F&C",
    "F&C・FC01",
    "F&C･FC01",
    "FC01",
    "F&C・FC02",
    "F&C･FC02",
    "FC02",
    "COCKTAIL SOFT",
    "カクテルソフト",
    "カクテル・ソフト",
    "FAIRYTALE",
    "フェアリーテール",
    "FAIRYTALE ETHIX",
    "HARDCOVER",
  ],
  [
    "Littlewitch",
    "Littlewitch（リトルウィッチ）",
    "Littlewitch",
    "リトルウィッチ",
    "リトルウイッチ",
    "Littlewitch velvet",
    "リトルウィッチ velvet",
    "リトルウィッチ・ベルベット",
    "リトルウィッチベルベット",
  ],
  ["feng", "feng（フォン）", "feng", "フォン", "ふぉん"],
] as const;

function cleanBrandLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^(?:ブランド|メーカー)\s*[:：]\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeBrandKey(value: string): string {
  return cleanBrandLabel(value)
    .toLocaleLowerCase("ja")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

const BRAND_ALIAS_INDEX = new Map<string, BrandIdentity>();

for (const [keyLabel, displayLabel, ...aliases] of BRAND_ALIAS_GROUPS) {
  const key = normalizeBrandKey(keyLabel);
  const identity = { key, label: displayLabel };
  for (const alias of [keyLabel, displayLabel, ...aliases]) {
    BRAND_ALIAS_INDEX.set(normalizeBrandKey(alias), identity);
  }
}

export function resolveBrandIdentity(value: string): BrandIdentity {
  const label = cleanBrandLabel(value);
  const normalized = normalizeBrandKey(label);
  return BRAND_ALIAS_INDEX.get(normalized) ?? { key: normalized, label };
}
