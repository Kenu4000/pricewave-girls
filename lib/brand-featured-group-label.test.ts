import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ブランド欄だけ注目候補をよく登録されているメーカーと表示する", async () => {
  const component = await readFile(
    new URL("../components/BrandFeaturedGroupLabel.tsx", import.meta.url),
    "utf8",
  );
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(component, /select\[name=\\"brand\\"\]/u);
  assert.match(component, /よく登録されているメーカー/u);
  assert.match(component, /group\.label === CURRENT_LABEL/u);
  assert.match(layout, /BrandFeaturedGroupLabel/u);
});
