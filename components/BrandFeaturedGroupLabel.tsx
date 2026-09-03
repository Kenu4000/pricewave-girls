"use client";

import { useEffect } from "react";

const CURRENT_LABEL = "よく登録されている";
const BRAND_LABEL = "よく登録されているメーカー";
const PRODUCT_COUNT_LABEL = "製品数が多い順";
const STOPPED_LABEL = "巡回停止";
const PRODUCT_COUNT_FIELD = "productCountBrandField";
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
  stopped: BrandOption[];
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

function ensureProductCountField(
  brandSelect: HTMLSelectElement,
  values: Array<{ value: string; label: string }>,
  selectedValue: string,
) {
  const brandField = brandSelect.closest<HTMLLabelElement>("label.filter-field");
  if (!brandField) return;

  let field = brandField.parentElement?.querySelector<HTMLLabelElement>(
    `label[data-${PRODUCT_COUNT_FIELD.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="true"]`,
  );
  if (!field) {
    field = document.createElement("label");
    field.className = "filter-field";
    field.dataset[PRODUCT_COUNT_FIELD] = "true";

    const label = document.createElement("span");
    label.textContent = PRODUCT_COUNT_LABEL;
    field.append(label);

    const countSelect = document.createElement("select");
    countSelect.className = "select";
    countSelect.dataset.productCountBrandSelect = "true";
    field.append(countSelect);

    brandField.insertAdjacentElement("afterend", field);
  }

  const countSelect = field.querySelector<HTMLSelectElement>(
    'select[data-product-count-brand-select="true"]',
  );
  if (!countSelect) return;

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "すべて";
  const options = values.map((source) => {
    const option = document.createElement("option");
    option.value = source.value;
    option.textContent = source.label;
    return option;
  });
  countSelect.replaceChildren(blank, ...options);
  countSelect.value = values.some((option) => option.value === selectedValue) ? selectedValue : "";

  countSelect.onchange = () => {
    brandSelect.value = countSelect.value;
    brandSelect.dispatchEvent(new Event("change", { bubbles: true }));
  };

  if (brandSelect.dataset.productCountSync !== "true") {
    brandSelect.dataset.productCountSync = "true";
    brandSelect.addEventListener("change", () => {
      const companion = brandSelect
        .closest<HTMLDivElement>(".advanced-filter-grid")
        ?.querySelector<HTMLSelectElement>('select[data-product-count-brand-select="true"]');
      if (!companion) return;
      companion.value = [...companion.options].some(
        (option) => option.value === brandSelect.value,
      )
        ? brandSelect.value
        : "";
    });
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

  const stoppedValues = available(groups.stopped).sort((left, right) =>
    japaneseCollator.compare(left.label, right.label),
  );
  const stoppedSet = new Set(stoppedValues.map((option) => option.value));
  const featuredValues = available(groups.featured)
    .filter((option) => !stoppedSet.has(option.value))
    .sort((left, right) => japaneseCollator.compare(left.label, right.label));
  const productCountValues = available(groups.byProductCount).filter(
    (option) => !stoppedSet.has(option.value),
  );
  const alphabeticalValues = [...options.values()]
    .filter((option) => !stoppedSet.has(option.value))
    .sort((left, right) => japaneseCollator.compare(left.label, right.label));
  const orderSignature = [
    featuredValues.map((option) => option.value).join("\u0000"),
    productCountValues.map((option) => option.value).join("\u0000"),
    alphabeticalValues.map((option) => option.value).join("\u0000"),
    stoppedValues.map((option) => option.value).join("\u0000"),
  ].join("\u0001");
  if (select.dataset.featuredBrandOrder === orderSignature) {
    ensureProductCountField(select, productCountValues, selectedValue);
    return;
  }

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
    appendGroup("五十音順", alphabeticalValues);
    appendGroup(STOPPED_LABEL, stoppedValues);

    select.replaceChildren(...fragments);
    select.value = selectedValue;
    select.dataset.featuredBrandOrder = orderSignature;
    ensureProductCountField(select, productCountValues, selectedValue);
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
    stopped?: BrandOption[];
  };
  cachedBrandGroups = {
    featured: Array.isArray(data.featured) ? data.featured : [],
    byProductCount: Array.isArray(data.byProductCount) ? data.byProductCount : [],
    stopped: Array.isArray(data.stopped) ? data.stopped : [],
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
