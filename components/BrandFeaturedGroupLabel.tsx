"use client";

import { useEffect } from "react";

const CURRENT_LABEL = "よく登録されている";
const BRAND_LABEL = "よく登録されているメーカー";

type FeaturedBrand = {
  value: string;
  label: string;
};

let cachedFeaturedBrands: FeaturedBrand[] | null = null;
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

function applyFeaturedBrandOrder(featuredBrands: FeaturedBrand[]) {
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

  const featuredValues = featuredBrands
    .map((brand) => brand.value)
    .filter((value) => options.has(value));
  const orderSignature = featuredValues.join("\u0000");
  if (select.dataset.featuredBrandOrder === orderSignature) return;

  const featuredSet = new Set(featuredValues);
  const alphabeticalValues = [...options.values()]
    .filter((option) => !featuredSet.has(option.value))
    .sort((left, right) => left.label.localeCompare(right.label, "ja"));

  applying = true;
  try {
    const fragments: Node[] = [];
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = allOption?.textContent?.trim() || "すべて";
    fragments.push(blank);

    if (featuredValues.length > 0) {
      const group = document.createElement("optgroup");
      group.label = BRAND_LABEL;
      for (const value of featuredValues) {
        const source = options.get(value);
        if (!source) continue;
        const option = document.createElement("option");
        option.value = source.value;
        option.textContent = source.label;
        group.append(option);
      }
      fragments.push(group);
    }

    if (alphabeticalValues.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "五十音順";
      for (const source of alphabeticalValues) {
        const option = document.createElement("option");
        option.value = source.value;
        option.textContent = source.label;
        group.append(option);
      }
      fragments.push(group);
    }

    select.replaceChildren(...fragments);
    select.value = selectedValue;
    select.dataset.featuredBrandOrder = orderSignature;
  } finally {
    applying = false;
  }
}

async function loadFeaturedBrands(): Promise<FeaturedBrand[]> {
  if (cachedFeaturedBrands) return cachedFeaturedBrands;
  const response = await fetch("/api/products/featured-brands", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as { featured?: FeaturedBrand[] };
  cachedFeaturedBrands = Array.isArray(data.featured) ? data.featured : [];
  return cachedFeaturedBrands;
}

export function BrandFeaturedGroupLabel() {
  useEffect(() => {
    renameBrandGroup();
    void loadFeaturedBrands()
      .then((featuredBrands) => applyFeaturedBrandOrder(featuredBrands))
      .catch(() => renameBrandGroup());

    const observer = new MutationObserver(() => {
      if (applying) return;
      if (cachedFeaturedBrands) applyFeaturedBrandOrder(cachedFeaturedBrands);
      else renameBrandGroup();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
