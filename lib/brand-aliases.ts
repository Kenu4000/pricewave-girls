export type BrandIdentity = {
  key: string;
  label: string;
};

const BRAND_ALIAS_GROUPS = [
  ["ALICESOFT", "ALICESOFT", "AliceSoft", "アリスソフト", "ありすそふと"],
  ["戯画", "戯画", "GIGA", "Giga"],
  ["FrontWing", "FrontWing", "フロントウィング", "フロントウイング"],
  ["NitroPlus", "NitroPlus", "Nitro+", "ニトロプラス"],
  ["Purple software", "Purple software", "パープルソフトウェア"],
  ["AQUAPLUS", "AQUAPLUS", "アクアプラス"],
  ["Liar-soft", "Liar-soft", "ライアーソフト"],
  ["Escu:de", "Escu:de", "エスクード"],
  ["Overflow", "Overflow", "オーバーフロー"],
  ["BLUE GALE", "BLUE GALE", "ブルーゲイル"],
  ["FlyingShine", "FlyingShine", "フライングシャイン"],
  ["UNiSONSHIFT", "UNiSONSHIFT", "ユニゾンシフト"],
  ["MAGES.", "MAGES.", "MAGES.(5pb.)", "5pb.", "5pb"],
  ["CandySoft", "CandySoft", "きゃんでぃそふと"],
  ["D.O.", "D.O.", "ディーオー"],
  ["HOOKSOFT", "HOOKSOFT", "HOOK"],
  ["âge", "âge", "age"],
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

for (const [label, ...aliases] of BRAND_ALIAS_GROUPS) {
  const key = normalizeBrandKey(label);
  const identity = { key, label };
  for (const alias of aliases) {
    BRAND_ALIAS_INDEX.set(normalizeBrandKey(alias), identity);
  }
}

export function resolveBrandIdentity(value: string): BrandIdentity {
  const label = cleanBrandLabel(value);
  const normalized = normalizeBrandKey(label);
  return BRAND_ALIAS_INDEX.get(normalized) ?? { key: normalized, label };
}
