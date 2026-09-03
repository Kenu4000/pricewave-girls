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

test("選抜メーカーは五十音順で表示し巡回中なら五十音一覧にも残す", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /featuredValues[\s\S]*japaneseCollator\.compare\(left\.label, right\.label\)/u);
  assert.match(component, /const alphabeticalValues = \[\.\.\.options\.values\(\)\]/u);
  assert.match(component, /!stoppedSet\.has\(option\.value\)/u);
  assert.doesNotMatch(component, /featuredSet/u);
});

test("mainのメーカー詳細検索に製品数が多い順を追加する", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/products/featured-brands/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(component, /製品数が多い順/u);
  assert.match(component, /byProductCount/u);
  assert.match(route, /rankFeaturedBrandsByCrawlFrequency\(products, 1\)/u);
  assert.match(route, /right\.total - left\.total/u);
  assert.match(route, /byProductCount/u);
});

test("全商品が巡回停止のメーカーは五十音順の下の巡回停止欄へ分離する", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/products/featured-brands/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /profile\.active === 0/u);
  assert.match(route, /profile\.active > 0/u);
  assert.match(route, /stoppedValues/u);
  assert.match(route, /stopped/u);
  assert.match(component, /STOPPED_LABEL = "巡回停止"/u);
  assert.match(component, /appendGroup\("五十音順", alphabeticalValues\);[\s\S]*appendGroup\(STOPPED_LABEL, stoppedValues\)/u);
  assert.match(component, /stoppedSet/u);
});

test("メーカー候補の組み替えにMutationObserverを使わない", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(component, /MutationObserver/u);
  assert.match(component, /cancelled/u);
});
