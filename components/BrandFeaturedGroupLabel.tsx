"use client";

import { useEffect } from "react";

const CURRENT_LABEL = "よく登録されている";
const BRAND_LABEL = "よく登録されているメーカー";

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

export function BrandFeaturedGroupLabel() {
  useEffect(() => {
    renameBrandGroup();
    const observer = new MutationObserver(renameBrandGroup);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
