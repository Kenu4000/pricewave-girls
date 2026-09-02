import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ブランド欄だけ注目候補をよく登録されているメーカーと表示する", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.ok(component.includes('select[name="brand"]'));
  assert.match(component, /よく登録されているメーカー/u);
  assert.match(component, /group\.label === CURRENT_LABEL/u);
  assert.match(layout, /BrandFeaturedGroupLabel/u);
});

test("よく登録されているメーカーは自動上位20件に指定追加を加える", async () => {
  const route = await readFile(
    new URL("../app/api/products/featured-brands/route.ts", import.meta.url),
    "utf8",
  );
  const selector = await readFile(
    new URL("../lib/brand-featured-crawl-order.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /selectFeaturedBrands\(products\)/u);
  assert.match(selector, /FEATURED_BRAND_LIMIT = 20/u);
  assert.match(selector, /const automatic =[\s\S]*\.slice\(0, Math\.max\(0, limit\)\)/u);
  assert.match(selector, /return \[\.\.\.automatic, \.\.\.pinned\]/u);
});

test("選抜メーカーも五十音順で表示し下の五十音一覧から除外しない", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /featuredValues[\s\S]*japaneseCollator\.compare\(left\.label, right\.label\)/u);
  assert.match(component, /const alphabeticalValues = \[\.\.\.options\.values\(\)\]\.sort/u);
  assert.doesNotMatch(component, /featuredSet/u);
  assert.doesNotMatch(component, /filter\(\(option\) => !featured/u);
});
