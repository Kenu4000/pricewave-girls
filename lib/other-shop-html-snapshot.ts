import * as cheerio from "cheerio";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSurugayaOtherShopUrl } from "@/lib/surugaya-other-shop-url";

const CAPTURE_ELEMENT_ID = "pricewave-other-shops-data";
const SNAPSHOT_ROOT_NAME = ".pricewave-snapshots";
const SNAPSHOT_SUBDIRECTORY = "other-shops";

export type OtherShopSnapshotMetadata = {
  productCode: string;
  capturedAt: string;
  sourceUrl: string;
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

export function otherShopSnapshotHtmlPath(productCode: string, rootDir = process.cwd()): string {
  assertProductCode(productCode);
  return path.join(otherShopSnapshotDirectory(rootDir), `${productCode}.html`);
}

export function otherShopSnapshotMetadataPath(productCode: string, rootDir = process.cwd()): string {
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

export function prepareOtherShopSnapshotHtml(rawHtml: string, sourceUrl: string): string {
  const $ = cheerio.load(rawHtml);

  // 保存HTMLは閲覧専用とし、駿河屋側のJavaScriptや埋め込みコンテンツは実行しない。
  $("script, iframe, object, embed, applet").remove();
  $("link[rel='modulepreload'], link[rel='preload'][as='script']").remove();
  $("meta[http-equiv]").each((_, element) => {
    const value = ($(element).attr("http-equiv") ?? "").toLowerCase();
    if (value === "content-security-policy" || value === "refresh") {
      $(element).remove();
    }
  });

  $("*").each((_, node) => {
    if (!("attribs" in node) || !node.attribs) return;
    for (const attribute of Object.keys(node.attribs)) {
      if (/^on/i.test(attribute) || attribute.toLowerCase() === "srcdoc") {
        $(node).removeAttr(attribute);
      }
    }
  });

  $("a[href], form[action]").each((_, element) => {
    const attribute = $(element).is("form") ? "action" : "href";
    const value = ($(element).attr(attribute) ?? "").trim();
    if (/^javascript:/iu.test(value)) $(element).removeAttr(attribute);
  });

  $("base").remove();
  const base = $("<base>").attr("href", sourceUrl).attr("target", "_blank");
  $("head").prepend(base);
  if ($("meta[name='viewport']").length === 0) {
    $("head").prepend(
      $("<meta>").attr("name", "viewport").attr("content", "width=device-width, initial-scale=1"),
    );
  }
  $("head").append(
    '<style id="pricewave-snapshot-guard">html,body{min-width:0!important}iframe,object,embed{display:none!important}</style>',
  );

  $("a[href]").attr("target", "_blank").attr("rel", "noreferrer noopener");
  $("form").attr("target", "_blank");

  return `<!doctype html>\n${$.html()}`;
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
    await Promise.all([
      rm(otherShopSnapshotHtmlPath(productCode, rootDir), { force: true }),
      rm(otherShopSnapshotMetadataPath(productCode, rootDir), { force: true }),
    ]);
    return { status: "cleared", productCode };
  }

  // loading/errorの場合は前回成功したスナップショットを残す。
  if (capture.state !== "ready" || !capture.html) {
    return { status: "ignored", reason: `他店舗一覧が未取得です (${capture.state ?? "unknown"})` };
  }

  const sourceUrl = buildSurugayaOtherShopUrl(surugayaUrl);
  if (!sourceUrl) return { status: "ignored", reason: "他店舗一覧URLを作成できません" };

  const directory = otherShopSnapshotDirectory(rootDir);
  await mkdir(directory, { recursive: true });
  const metadata: OtherShopSnapshotMetadata = {
    productCode,
    capturedAt: checkedAt.toISOString(),
    sourceUrl,
  };
  await Promise.all([
    writeFile(
      otherShopSnapshotHtmlPath(productCode, rootDir),
      prepareOtherShopSnapshotHtml(capture.html, sourceUrl),
      "utf8",
    ),
    writeFile(
      otherShopSnapshotMetadataPath(productCode, rootDir),
      JSON.stringify(metadata, null, 2),
      "utf8",
    ),
  ]);

  return { status: "saved", metadata };
}

export async function readOtherShopSnapshotMetadata(
  rawUrl: string | null | undefined,
  rootDir = process.cwd(),
): Promise<OtherShopSnapshotMetadata | null> {
  const productCode = otherShopProductCode(rawUrl);
  if (!productCode) return null;

  try {
    const parsed = JSON.parse(
      await readFile(otherShopSnapshotMetadataPath(productCode, rootDir), "utf8"),
    ) as Partial<OtherShopSnapshotMetadata>;
    if (
      parsed.productCode !== productCode ||
      typeof parsed.capturedAt !== "string" ||
      typeof parsed.sourceUrl !== "string"
    ) {
      return null;
    }
    return {
      productCode,
      capturedAt: parsed.capturedAt,
      sourceUrl: parsed.sourceUrl,
    };
  } catch {
    return null;
  }
}

export async function readOtherShopSnapshotHtml(
  productCode: string,
  rootDir = process.cwd(),
): Promise<string | null> {
  try {
    return await readFile(otherShopSnapshotHtmlPath(productCode, rootDir), "utf8");
  } catch {
    return null;
  }
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
