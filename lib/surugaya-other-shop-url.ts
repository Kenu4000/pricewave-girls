export function buildSurugayaOtherShopUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "suruga-ya.jp" && hostname !== "www.suruga-ya.jp") {
      return null;
    }

    const match = parsed.pathname.match(/^\/product\/(?:detail|other)\/([0-9A-Za-z]+)\/?$/u);
    if (!match) return null;

    return `https://www.suruga-ya.jp/product/other/${match[1]}`;
  } catch {
    return null;
  }
}
