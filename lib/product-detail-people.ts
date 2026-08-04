import * as cheerio from "cheerio";
import { normalizeFilterChoiceValue, splitDetailPeople } from "@/lib/product-filter-options";
import type { FetchedProduct } from "@/lib/surugaya";

const PEOPLE_LABELS = ["原画", "原画家", "シナリオ", "脚本", "声優", "キャスト"] as const;
const PEOPLE_LABEL_KEYS = new Set(PEOPLE_LABELS.map(normalizeFilterChoiceValue));

export function preserveIndividualDetailPeople(
  html: string,
  fetched: FetchedProduct,
): FetchedProduct {
  const details = { ...fetched.details };
  const peopleByLabel = collectExistingPeople(details);
  collectPeopleFromHtml(html, peopleByLabel);

  for (const [label, people] of peopleByLabel) {
    if (people.length > 0) details[label] = people.join("\n");
  }

  return { ...fetched, details };
}

function collectExistingPeople(details: Record<string, string>): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [label, value] of Object.entries(details)) {
    if (!PEOPLE_LABEL_KEYS.has(normalizeFilterChoiceValue(label))) continue;
    addPeople(result, label, splitDetailPeople(value));
  }

  return result;
}

function collectPeopleFromHtml(html: string, peopleByLabel: Map<string, string[]>) {
  const $ = cheerio.load(html);

  $("table tr").each((_, row) => {
    const cells = $(row).children("th, td").toArray();
    for (let index = 0; index + 1 < cells.length; index += 2) {
      const label = normalizeText($(cells[index]).text()).replace(/[：:]$/u, "").trim();
      if (!PEOPLE_LABEL_KEYS.has(normalizeFilterChoiceValue(label))) continue;
      addPeople(peopleByLabel, label, peopleFromElement($, $(cells[index + 1])));
    }
  });

  $("dl").each((_, list) => {
    $(list)
      .children("dt")
      .each((__, term) => {
        const label = normalizeText($(term).text()).replace(/[：:]$/u, "").trim();
        if (!PEOPLE_LABEL_KEYS.has(normalizeFilterChoiceValue(label))) return;
        addPeople(peopleByLabel, label, peopleFromElement($, $(term).next("dd")));
      });
  });
}

function peopleFromElement(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>,
): string[] {
  const linkedPeople = element
    .find("a")
    .toArray()
    .flatMap((anchor) => splitDetailPeople(normalizeText($(anchor).text())));

  if (linkedPeople.length > 0) return linkedPeople;
  return splitDetailPeople(normalizeText(element.text()));
}

function addPeople(target: Map<string, string[]>, label: string, values: string[]) {
  const existingLabel =
    [...target.keys()].find(
      (candidate) => normalizeFilterChoiceValue(candidate) === normalizeFilterChoiceValue(label),
    ) ?? label;
  const merged = target.get(existingLabel) ?? [];
  const seen = new Set(merged.map(normalizePersonKey));

  for (const value of values) {
    const normalized = value.trim();
    const key = normalizePersonKey(normalized);
    if (!normalized || !key || seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }

  target.set(existingLabel, merged);
}

function normalizePersonKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/\s+/gu, "").trim();
}

function normalizeText(value: string): string {
  return value.replace(/[\u00a0\u3000]/gu, " ").replace(/\s+/gu, " ").trim();
}
