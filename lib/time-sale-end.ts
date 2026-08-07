import * as cheerio from "cheerio";

const END_ATTRIBUTE_NAMES = [
  "data-end",
  "data-end-at",
  "data-endtime",
  "data-end-time",
  "data-countdown-end",
  "datetime",
] as const;

export function detectTimeSaleEndAt(html: string, now = new Date()): Date | null {
  const primaryHtml = html.split("その他の状態を選ぶ", 1)[0] ?? html;
  const $ = cheerio.load(primaryHtml);
  const body = $("body");
  const endLabels = body
    .find("*")
    .filter((_, element) => normalizeText($(element).text()).includes("終了まで"));

  for (const element of endLabels.toArray()) {
    let scope = $(element);
    for (let level = 0; level < 4 && scope.length > 0; level += 1) {
      const absolute = absoluteEndAtFromScope($, scope);
      if (absolute) return absolute;

      const remaining = remainingMilliseconds(normalizeText(scope.text()));
      if (remaining !== null) return new Date(now.getTime() + remaining);
      scope = scope.parent();
    }
  }

  return null;
}

function absoluteEndAtFromScope(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<cheerio.AnyNode>,
): Date | null {
  const nodes = scope.find("*").addBack();
  for (const node of nodes.toArray()) {
    const element = $(node);
    for (const attribute of END_ATTRIBUTE_NAMES) {
      const parsed = parseAbsoluteDate(element.attr(attribute));
      if (parsed) return parsed;
    }
  }
  return null;
}

function parseAbsoluteDate(raw: string | undefined): Date | null {
  const value = raw?.trim();
  if (!value) return null;

  if (/^\d{10,13}$/u.test(value)) {
    const numeric = Number(value);
    const milliseconds = value.length === 10 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (!/[T:/-]/u.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? null : new Date(milliseconds);
}

function remainingMilliseconds(text: string): number | null {
  const markerIndex = text.indexOf("終了まで");
  if (markerIndex < 0) return null;
  const afterMarker = text.slice(markerIndex + "終了まで".length, markerIndex + 160);

  const dayClock = afterMarker.match(
    /(?:(\d{1,3})\s*日)?\s*(\d{1,3})\s*[:：]\s*(\d{2})\s*[:：]\s*(\d{2})/u,
  );
  if (dayClock) {
    const days = Number(dayClock[1] ?? 0);
    const hours = Number(dayClock[2]);
    const minutes = Number(dayClock[3]);
    const seconds = Number(dayClock[4]);
    if (minutes < 60 && seconds < 60) {
      return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    }
  }

  const japanese = afterMarker.match(
    /(?:(\d{1,3})\s*日)?\s*(?:(\d{1,3})\s*時間)?\s*(?:(\d{1,2})\s*分)?\s*(?:(\d{1,2})\s*秒)/u,
  );
  if (japanese) {
    const days = Number(japanese[1] ?? 0);
    const hours = Number(japanese[2] ?? 0);
    const minutes = Number(japanese[3] ?? 0);
    const seconds = Number(japanese[4] ?? 0);
    if (minutes < 60 && seconds < 60) {
      return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    }
  }

  return null;
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/gu, " ").replace(/\s+/gu, " ").trim();
}
