import * as cheerio from "cheerio";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSurugayaOtherShopUrl } from "@/lib/surugaya-other-shop-url";

const DESKTOP_CAPTURE_ELEMENT_ID = "pricewave-other-shops-data";
const MOBILE_CAPTURE_ELEMENT_ID = "pricewave-other-shops-mobile-data";
const SNAPSHOT_ROOT_NAME = ".pricewave-snapshots";
const SNAPSHOT_SUBDIRECTORY = "other-shops";

export type OtherShopSnapshotVariant = "desktop" | "mobile";

export type OtherShopSnapshotMetadata = {
  productCode: string;
  sourceUrl: string;
  desktopCapturedAt: string | null;
  mobileCapturedAt: string | null;
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

export function otherShopSnapshotHtmlPath(
  productCode: string,
  rootDir = process.cwd(),
  variant: OtherShopSnapshotVariant = "desktop",
): string {
  assertProductCode(productCode);
  const suffix = variant === "mobile" ? ".mobile.html" : ".html";
  return path.join(otherShopSnapshotDirectory(rootDir), `${productCode}${suffix}`);
}

export function otherShopSnapshotMetadataPath(productCode: string, rootDir = process.cwd()): string {
  assertProductCode(productCode);
  return path.join(otherShopSnapshotDirectory(rootDir), `${productCode}.json`);
}

export function extractCapturedOtherShopHtml(
  productHtml: string,
  variant: OtherShopSnapshotVariant = "desktop",
): {
  state: string | null;
  html: string | null;
} {
  const $ = cheerio.load(productHtml);
  const id = variant === "mobile" ? MOBILE_CAPTURE_ELEMENT_ID : DESKTOP_CAPTURE_ELEMENT_ID;
  const marker = $(`#${id}`).first();
  if (marker.length === 0) return { state: null, html: null };

  const state = marker.attr("data-state") ?? null;
  const html = marker.text().trim();
  return { state, html: html || null };
}

export function prepareOtherShopSnapshotHtml(
  rawHtml: string,
  sourceUrl: string,
  variant: OtherShopSnapshotVariant = "desktop",
): string {
  const $ = cheerio.load(rawHtml);

  // 表示時に駿河屋側へ能動的な処理を送らないよう、保存版は閲覧専用にする。
  // DOMと駿河屋自身のCSS・画像は残し、取得時に確定したUIをそのまま再現する。
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
  $("head").prepend($("<base>").attr("href", sourceUrl).attr("target", "_blank"));

  // モバイル版はモバイルUAで取得した専用DOMを保存する。
  // viewportだけはViewerの実画面幅へ合わせ、PC版HTMLには手を加えない。
  if (variant === "mobile") {
    $("meta[name='viewport']").remove();
    $("head").prepend(
      $("<meta>")
        .attr("name", "viewport")
        .attr("content", "width=device-width, initial-scale=1, viewport-fit=cover"),
    );
  }

  $("head").append(
    '<style id="pricewave-snapshot-guard">iframe,object,embed{display:none!important}</style>',
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

  const desktopCapture = extractCapturedOtherShopHtml(productHtml, "desktop");
  const mobileCapture = extractCapturedOtherShopHtml(productHtml, "mobile");
  if (desktopCapture.state === null && mobileCapture.state === null) {
    return { status: "ignored", reason: "他店舗一覧の取得マーカーがありません" };
  }

  if (desktopCapture.state === "not_applicable") {
    await Promise.all([
      rm(otherShopSnapshotHtmlPath(productCode, rootDir, "desktop"), { force: true }),
      rm(otherShopSnapshotHtmlPath(productCode, rootDir, "mobile"), { force: true }),
      rm(otherShopSnapshotMetadataPath(productCode, rootDir), { force: true }),
    ]);
    return { status: "cleared", productCode };
  }

  const sourceUrl = buildSurugayaOtherShopUrl(surugayaUrl);
  if (!sourceUrl) return { status: "ignored", reason: "他店舗一覧URLを作成できません" };

  const previous = await readOtherShopSnapshotMetadata(surugayaUrl, rootDir);
  const metadata: OtherShopSnapshotMetadata = previous ?? {
    productCode,
    sourceUrl,
    desktopCapturedAt: null,
    mobileCapturedAt: null,
  };
  metadata.sourceUrl = sourceUrl;

  const directory = otherShopSnapshotDirectory(rootDir);
  const writes: Promise<unknown>[] = [];
  let saved = false;

  if (desktopCapture.state === "ready" && desktopCapture.html) {
    await mkdir(directory, { recursive: true });
    metadata.desktopCapturedAt = checkedAt.toISOString();
    writes.push(
      writeFile(
        otherShopSnapshotHtmlPath(productCode, rootDir, "desktop"),
        prepareOtherShopSnapshotHtml(desktopCapture.html, sourceUrl, "desktop"),
        "utf8",
      ),
    );
    saved = true;
  }

  if (mobileCapture.state === "ready" && mobileCapture.html) {
    await mkdir(directory, { recursive: true });
    metadata.mobileCapturedAt = checkedAt.toISOString();
    writes.push(
      writeFile(
        otherShopSnapshotHtmlPath(productCode, rootDir, "mobile"),
        prepareOtherShopSnapshotHtml(mobileCapture.html, sourceUrl, "mobile"),
        "utf8",
      ),
    );
    saved = true;
  }

  if (!saved) {
    return {
      status: "ignored",
      reason: `他店舗一覧が未取得です (desktop=${desktopCapture.state ?? "unknown"}, mobile=${mobileCapture.state ?? "unknown"})`,
    };
  }

  writes.push(
    writeFile(
      otherShopSnapshotMetadataPath(productCode, rootDir),
      JSON.stringify(metadata, null, 2),
      "utf8",
    ),
  );
  await Promise.all(writes);

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
    ) as Partial<OtherShopSnapshotMetadata> & { capturedAt?: unknown };
    if (typeof parsed.sourceUrl !== "string") return null;

    // PR #53/#54で保存した旧形式はPC版スナップショットとして引き継ぐ。
    const legacyCapturedAt = typeof parsed.capturedAt === "string" ? parsed.capturedAt : null;
    const desktopCapturedAt =
      typeof parsed.desktopCapturedAt === "string" ? parsed.desktopCapturedAt : legacyCapturedAt;
    const mobileCapturedAt =
      typeof parsed.mobileCapturedAt === "string" ? parsed.mobileCapturedAt : null;
    if (!desktopCapturedAt && !mobileCapturedAt) return null;

    return {
      productCode,
      sourceUrl: parsed.sourceUrl,
      desktopCapturedAt,
      mobileCapturedAt,
    };
  } catch {
    return null;
  }
}

export async function readOtherShopSnapshotHtml(
  productCode: string,
  variant: OtherShopSnapshotVariant = "desktop",
  rootDir = process.cwd(),
): Promise<string | null> {
  try {
    return await readFile(otherShopSnapshotHtmlPath(productCode, rootDir, variant), "utf8");
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
