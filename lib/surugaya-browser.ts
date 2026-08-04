import path from "node:path";
import { chromium, type BrowserContext } from "playwright";

type PersistentContextOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
>;

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0";

export class SurugayaBrowserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SurugayaBrowserError";
  }
}

export async function fetchSurugayaHtml(url: string): Promise<string> {
  return withBrowserLock(() => fetchSurugayaHtmlUnlocked(url));
}

let browserQueue: Promise<void> = Promise.resolve();

async function withBrowserLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = browserQueue;
  let release: () => void = () => {};
  browserQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function fetchSurugayaHtmlUnlocked(url: string): Promise<string> {
  const context = await launchBrowserContext();

  try {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.route("**/*", async (route) => {
        const resourceType = route.request().resourceType();
        if (["font", "media"].includes(resourceType)) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    const timeout = readTimeout();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    const response = await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForFunction(
        () => {
          const heading = document.querySelector("h1")?.textContent?.trim() ?? "";
          return heading.length > 0 && !/just a moment|確認中|しばらくお待ち/i.test(heading);
        },
        undefined,
        { timeout },
      );
    } catch {
      // The HTML below contains enough information to distinguish a Cloudflare
      // challenge from a genuine Surugaya page and produce a useful error.
    }

    const html = await page.content();
    if (isCloudflareChallenge(html)) {
      throw new SurugayaBrowserError(
        "駿河屋のアクセス確認を通過できませんでした。" +
          "SURUGAYA_BROWSER_HEADLESS=false にして再起動し、表示されたブラウザで確認を完了してください。",
      );
    }

    const headingElement = page.locator("h1").first();
    const heading =
      (await headingElement.count()) > 0
        ? normalizeHeading(await headingElement.textContent())
        : "";
    if (response && response.status() >= 400 && !heading) {
      throw new SurugayaBrowserError(
        `駿河屋ページの取得に失敗しました: ${response.status()}`,
      );
    }

    if (!heading || !html.includes("商品詳細情報")) {
      throw new SurugayaBrowserError("駿河屋の商品詳細ページを確認できませんでした");
    }

    return html;
  } catch (caught) {
    if (caught instanceof SurugayaBrowserError) {
      throw caught;
    }

    const detail = caught instanceof Error ? caught.message : String(caught);
    throw new SurugayaBrowserError(`ブラウザで駿河屋ページを取得できませんでした: ${detail}`, {
      cause: caught,
    });
  } finally {
    await context.close();
  }
}

async function launchBrowserContext(): Promise<BrowserContext> {
  const channelFromEnvironment = process.env.SURUGAYA_BROWSER_CHANNEL?.trim();
  const executablePath = process.env.SURUGAYA_BROWSER_EXECUTABLE_PATH?.trim();
  const defaultChannel = process.platform === "win32" ? "msedge" : undefined;
  const channel = channelFromEnvironment || defaultChannel;
  const options: PersistentContextOptions = {
    extraHTTPHeaders: {
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
    headless: process.env.SURUGAYA_BROWSER_HEADLESS !== "false",
    ignoreHTTPSErrors: process.env.SURUGAYA_BROWSER_IGNORE_HTTPS_ERRORS === "true",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    userAgent: process.env.SURUGAYA_BROWSER_USER_AGENT ?? DEFAULT_USER_AGENT,
    viewport: { width: 1440, height: 1000 },
  };
  const userDataDirectory = path.join(process.cwd(), ".pricewave-browser");
  const proxy = readProxy();

  if (proxy) {
    options.proxy = proxy;
  }

  if (executablePath) {
    options.executablePath = executablePath;
  } else if (channel) {
    options.channel = channel;
  }

  try {
    return await chromium.launchPersistentContext(userDataDirectory, options);
  } catch (caught) {
    if (executablePath || channelFromEnvironment || !channel) {
      throw browserLaunchError(caught);
    }

    try {
      const fallbackOptions = { ...options };
      delete fallbackOptions.channel;
      return await chromium.launchPersistentContext(userDataDirectory, fallbackOptions);
    } catch (fallbackError) {
      throw browserLaunchError(fallbackError);
    }
  }
}

function browserLaunchError(caught: unknown): SurugayaBrowserError {
  const detail = caught instanceof Error ? caught.message : String(caught);
  return new SurugayaBrowserError(
    "価格取得用ブラウザを起動できませんでした。" +
      "WindowsではMicrosoft Edgeをインストールするか、" +
      "`npx playwright install chromium`を実行してください。" +
      ` 詳細: ${detail}`,
    { cause: caught },
  );
}

function isCloudflareChallenge(html: string): boolean {
  return (
    /cf-mitigated|challenge-platform|cf-chl-/i.test(html) ||
    /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
  );
}

function readTimeout(): number {
  const configured = Number(process.env.SURUGAYA_BROWSER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5_000 ? configured : DEFAULT_TIMEOUT_MS;
}

function normalizeHeading(heading: string | null): string {
  const normalized = heading?.replace(/\s+/g, " ").trim() ?? "";
  return /just a moment|確認中|しばらくお待ち/i.test(normalized) ? "" : normalized;
}

function readProxy(): PersistentContextOptions["proxy"] {
  const rawProxy =
    process.env.SURUGAYA_BROWSER_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim();

  if (!rawProxy) {
    return undefined;
  }

  try {
    const parsed = new URL(rawProxy);
    return {
      server: `${parsed.protocol}//${parsed.host}`,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    return { server: rawProxy };
  }
}
