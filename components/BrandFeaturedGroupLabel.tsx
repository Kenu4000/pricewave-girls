"use client";

import { useEffect } from "react";

const CURRENT_LABEL = "よく登録されている";
const BRAND_LABEL = "よく登録されているメーカー";
const PRODUCT_COUNT_LABEL = "製品数が多い順";
const japaneseCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});

type BrandOption = {
  value: string;
  label: string;
};

type BrandGroups = {
  featured: BrandOption[];
  byProductCount: BrandOption[];
};

let cachedBrandGroups: BrandGroups | null = null;
let applying = false;

function renameBrandGroup() {
  const select = document.querySelector<HTMLSelectElement>('select[name="brand"]');
  if (!select) return;

  for (const group of select.querySelectorAll<HTMLOptGroupElement>("optgroup")) {
    if (group.label === CURRENT_LABEL) {
      group.label = BRAND_LABEL;
      break;
    }
  }
}

function applyBrandOrder(groups: BrandGroups) {
  if (applying) return;
  const select = document.querySelector<HTMLSelectElement>('select[name="brand"]');
  if (!select) return;

  const selectedValue = select.value;
  const allOption = [...select.querySelectorAll<HTMLOptionElement>("option")].find(
    (option) => option.value === "",
  );
  const options = new Map(
    [...select.querySelectorAll<HTMLOptionElement>("option")]
      .filter((option) => option.value !== "")
      .map((option) => [
        option.value,
        { value: option.value, label: option.textContent?.trim() || option.value },
      ]),
  );

  const available = (source: BrandOption[]) =>
    source
      .map((brand) => brand.value)
      .filter((value) => options.has(value))
      .map((value) => options.get(value))
      .filter((option): option is { value: string; label: string } => Boolean(option));

  const featuredValues = available(groups.featured).sort((left, right) =>
    japaneseCollator.compare(left.label, right.label),
  );
  const productCountValues = available(groups.byProductCount);
  const alphabeticalValues = [...options.values()].sort((left, right) =>
    japaneseCollator.compare(left.label, right.label),
  );
  const orderSignature = [
    featuredValues.map((option) => option.value).join("\u0000"),
    productCountValues.map((option) => option.value).join("\u0000"),
    alphabeticalValues.map((option) => option.value).join("\u0000"),
  ].join("\u0001");
  if (select.dataset.featuredBrandOrder === orderSignature) return;

  applying = true;
  try {
    const fragments: Node[] = [];
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = allOption?.textContent?.trim() || "すべて";
    fragments.push(blank);

    const appendGroup = (label: string, values: Array<{ value: string; label: string }>) => {
      if (values.length === 0) return;
      const group = document.createElement("optgroup");
      group.label = label;
      for (const source of values) {
        const option = document.createElement("option");
        option.value = source.value;
        option.textContent = source.label;
        group.append(option);
      }
      fragments.push(group);
    };

    appendGroup(BRAND_LABEL, featuredValues);
    appendGroup(PRODUCT_COUNT_LABEL, productCountValues);
    appendGroup("五十音順", alphabeticalValues);

    select.replaceChildren(...fragments);
    select.value = selectedValue;
    select.dataset.featuredBrandOrder = orderSignature;
  } finally {
    applying = false;
  }
}

async function loadBrandGroups(): Promise<BrandGroups> {
  if (cachedBrandGroups) return cachedBrandGroups;
  const response = await fetch("/api/products/featured-brands", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as {
    featured?: BrandOption[];
    byProductCount?: BrandOption[];
  };
  cachedBrandGroups = {
    featured: Array.isArray(data.featured) ? data.featured : [],
    byProductCount: Array.isArray(data.byProductCount) ? data.byProductCount : [],
  };
  return cachedBrandGroups;
}

export function BrandFeaturedGroupLabel() {
  useEffect(() => {
    let cancelled = false;
    renameBrandGroup();

    void loadBrandGroups()
      .then((groups) => {
        if (!cancelled) applyBrandOrder(groups);
      })
      .catch(() => {
        if (!cancelled) renameBrandGroup();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
