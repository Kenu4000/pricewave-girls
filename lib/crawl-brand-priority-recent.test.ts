import assert from "node:assert/strict";
import test from "node:test";
import {
  isRecentDailyCrawlBrand,
  recentDailyCrawlBrandCount,
} from "./crawl-brand-priority-recent";

test("新作中心の追加ブランドを毎日巡回する", () => {
  for (const brand of [
    "Acacia",
    "Orthros",
    "metalogiq",
    "Zerocreation Games",
    "バグシステム",
    "GIRL’S SOFTWARE",
    "墓場文庫",
    "しるき～ずこねくと",
    "アトリエさくら",
    "ブシロードゲームズ",
    "G-MODE",
    "キネティックノベルス",
    "qureate",
    "milimili:AMUSE CRAFT EROTICA",
    "ILLGAMES",
    "ぱこぱこそふと",
    "SukeraSomero",
    "オトメイト",
    "SYRUP -many milk-",
  ]) {
    assert.equal(isRecentDailyCrawlBrand([brand]), true, brand);
  }
  assert.equal(recentDailyCrawlBrandCount, 19);
});

test("今回の同人ブランドは追加しない", () => {
  for (const brand of [
    "トトメトリ",
    "Whisp",
    "Chatte Noire",
    "NANACAN",
    "NEKO WORKs",
    "ADELTA",
  ]) {
    assert.equal(isRecentDailyCrawlBrand([brand]), false, brand);
  }
});

test("全角半角や記号の表記差を吸収する", () => {
  assert.equal(isRecentDailyCrawlBrand(["GIRL'S SOFTWARE"]), true);
  assert.equal(isRecentDailyCrawlBrand(["SYRUP many milk"]), true);
});
