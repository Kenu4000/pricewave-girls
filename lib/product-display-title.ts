const STOREFRONT_PLATFORM_PREFIX =
  /^(?:Windows|Macintosh|Mac(?:\s*OS)?|PC[- ]?98|X68000|FM[- ]?TOWNS|MS[- ]?DOS|DOS)/iu;
const STOREFRONT_SOFTWARE_PREFIX = /^(.{1,100}?ソフト)[\s　]+(.+)$/u;

export type ProductDisplayTitleParts = {
  title: string;
  suffix: string | null;
};

export function splitProductDisplayTitle(value: string): ProductDisplayTitleParts {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || !STOREFRONT_PLATFORM_PREFIX.test(trimmed)) {
    return { title: trimmed, suffix: null };
  }

  const match = STOREFRONT_SOFTWARE_PREFIX.exec(trimmed);
  if (!match) return { title: trimmed, suffix: null };

  const suffix = match[1].trim();
  const title = match[2].trim();
  if (!title || !suffix) return { title: trimmed, suffix: null };
  return { title, suffix };
}

export function formatProductDisplayTitle(value: string): string {
  const parts = splitProductDisplayTitle(value);
  return parts.suffix ? `${parts.title}　${parts.suffix}` : parts.title;
}
