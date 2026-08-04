import { normalizeCrawlBrand } from "./crawl-brand-priority";

const RECENT_DAILY_BRANDS = `
Acacia
Orthros
metalogiq
Zerocreation Games
バグシステム
GIRL’S SOFTWARE
墓場文庫
しるき～ずこねくと
アトリエさくら
ブシロードゲームズ
G-MODE
キネティックノベルス
qureate
milimili:AMUSE CRAFT EROTICA
ILLGAMES
ぱこぱこそふと
SukeraSomero
オトメイト
SYRUP -many milk-
`;

const RECENT_DAILY_BRAND_KEYS = new Set(
  RECENT_DAILY_BRANDS
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeCrawlBrand),
);

export function isRecentDailyCrawlBrand(candidates: string[]): boolean {
  return candidates.some((candidate) =>
    RECENT_DAILY_BRAND_KEYS.has(normalizeCrawlBrand(candidate)),
  );
}

export const recentDailyCrawlBrandCount = RECENT_DAILY_BRAND_KEYS.size;
