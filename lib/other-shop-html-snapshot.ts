import * as cheerio from "cheerio";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractOtherShopItems } from "@/lib/surugaya";
import { buildSurugayaOtherShopUrl } from "@/lib/surugaya-other-shop-url";

const CAPTURE_ELEMENT_ID = "pricewave-other-shops-data";
const SNAPSHOT_ROOT_NAME = ".pricewave-snapshots";
const SNAPSHOT_SUBDIRECTORY = "other-shops";

export type OtherShopSnapshotItem = {
  storeName: string;
  condition: string;
  price: number;
};

export type OtherShopSnapshotData = {
  productCode: string;
  sourceUrl: string;
  capturedAt: string;
  items: OtherShopSnapshotItem[];
};

export type OtherShopSnapshotMetadata = Omit<OtherShopSnapshotData, "items"> & {
  itemCount: number;
};

export type OtherShopSnapshotSyncResult =
  | { status: "saved"; metadata: OtherShopSnapshotMetadata }
  | { status: "cleared"; productCode: string }
  | { status: "ignored"; reason: string };

export function otherShopProductCode(rawUrl: string | null | undefined): string | null {
  const otherShopUrl = buildSurugayaOtherShopUrl(rawUrl);
  return otherShopUrl?.match(/\/product\/other\/([0-9A-Za-z]+)\/?$/u)?.[1] ?? null;
}

export function otherShopSnapshotDirectory(rootDir = process.cwd()): string {
  return path.join(rootDir, SNAPSHOT_ROOT_NAME, SNAPSHOT_SUBDIRECTORY);
}

export function otherShopSnapshotJsonPath(productCode: string, rootDir = process.cwd()): string {
  assertProductCode(productCode);
  return path.join(otherShopSnapshotDirectory(rootDir), `${productCode}.json`);
}

export function extractCapturedOtherShopHtml(productHtml: string): {
  state: string | null;
  html: string | null;
} {
  const $ = cheerio.load(productHtml);
  const marker = $(`#${CAPTURE_ELEMENT_ID}`).first();
  if (marker.length === 0) return { state: null, html: null };

  const state = marker.attr("data-state") ?? null;
  const html = marker.text().trim();
  return { state, html: html || null };
}

export function parseOtherShopSnapshotItems(rawHtml: string): OtherShopSnapshotItem[] {
  return extractOtherShopItems(rawHtml)
    .filter((item) => item.sourceType === "other_shop")
    .map((item) => ({
      storeName: item.storeName ?? "店舗名不明",
      condition: item.condition,
      price: item.price,
    }));
}

export async function syncOtherShopSnapshotFromProductHtml({
  surugayaUrl,
  productHtml,
  checkedAt,
  rootDir = process.cwd(),
}: {
  surugayaUrl: string;
  productHtml: string;
  checkedAt: Date;
  rootDir?: string;
}): Promise<OtherShopSnapshotSyncResult> {
  const productCode = otherShopProductCode(surugayaUrl);
  if (!productCode) return { status: "ignored", reason: "商品コードを取得できません" };

  const capture = extractCapturedOtherShopHtml(productHtml);
  if (capture.state === null) {
    return { status: "ignored", reason: "他店舗一覧の取得マーカーがありません" };
  }

  if (capture.state === "not_applicable") {
    await rm(otherShopSnapshotJsonPath(productCode, rootDir), { force: true });
    return { status: "cleared", productCode };
  }

  if (capture.state !== "ready" || !capture.html) {
    return {
      status: "ignored",
      reason: `他店舗一覧が未取得です (state=${capture.state ?? "unknown"})`,
    };
  }

  const sourceUrl = buildSurugayaOtherShopUrl(surugayaUrl);
  if (!sourceUrl) return { status: "ignored", reason: "他店舗一覧URLを作成できません" };

  const data: OtherShopSnapshotData = {
    productCode,
    sourceUrl,
    capturedAt: checkedAt.toISOString(),
    items: parseOtherShopSnapshotItems(capture.html),
  };

  const directory = otherShopSnapshotDirectory(rootDir);
  await mkdir(directory, { recursive: true });
  await writeFile(otherShopSnapshotJsonPath(productCode, rootDir), JSON.stringify(data, null, 2), "utf8");

  return {
    status: "saved",
    metadata: {
      productCode,
      sourceUrl,
      capturedAt: data.capturedAt,
      itemCount: data.items.length,
    },
  };
}

export async function readOtherShopSnapshotData(
  rawUrl: string | null | undefined,
  rootDir = process.cwd(),
): Promise<OtherShopSnapshotData | null> {
  const productCode = otherShopProductCode(rawUrl);
  if (!productCode) return null;

  try {
    const parsed = JSON.parse(
      await readFile(otherShopSnapshotJsonPath(productCode, rootDir), "utf8"),
    ) as Partial<OtherShopSnapshotData>;
    if (
      parsed.productCode !== productCode ||
      typeof parsed.sourceUrl !== "string" ||
      typeof parsed.capturedAt !== "string" ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }

    const items = parsed.items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<OtherShopSnapshotItem>;
      if (
        typeof candidate.storeName !== "string" ||
        typeof candidate.condition !== "string" ||
        typeof candidate.price !== "number" ||
        !Number.isFinite(candidate.price)
      ) {
        return [];
      }
      return [{
        storeName: candidate.storeName,
        condition: candidate.condition,
        price: candidate.price,
      }];
    });

    return {
      productCode,
      sourceUrl: parsed.sourceUrl,
      capturedAt: parsed.capturedAt,
      items,
    };
  } catch {
    return null;
  }
}

export async function readOtherShopSnapshotMetadata(
  rawUrl: string | null | undefined,
  rootDir = process.cwd(),
): Promise<OtherShopSnapshotMetadata | null> {
  const data = await readOtherShopSnapshotData(rawUrl, rootDir);
  return data
    ? {
        productCode: data.productCode,
        sourceUrl: data.sourceUrl,
        capturedAt: data.capturedAt,
        itemCount: data.items.length,
      }
    : null;
}

export async function exportOtherShopSnapshots(
  outputDirectory: string,
  rootDir = process.cwd(),
): Promise<void> {
  const sourceDirectory = otherShopSnapshotDirectory(rootDir);
  try {
    await cp(sourceDirectory, outputDirectory, { recursive: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code !== "ENOENT") throw error;
  }
}

function assertProductCode(productCode: string): void {
  if (!/^[0-9A-Za-z]+$/u.test(productCode)) {
    throw new Error("不正な駿河屋商品コードです");
  }
}
