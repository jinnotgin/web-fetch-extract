import puppeteer, { type Browser, type HTTPRequest, type Page } from "puppeteer";

import type { AppConfig } from "../config.js";
import type { ExtractRequest } from "../types/api.js";
import {
  validateUrlPolicy,
  type DnsLookup,
  type UrlPolicyInput
} from "./urlPolicy.js";

export type BrowserExtractionInput = {
  url: string;
  request: ExtractRequest;
  config: AppConfig;
  lookup?: DnsLookup;
};

export type BrowserExtractionResult = {
  title: string | null;
  text: string;
  finalUrl: string;
  warnings: string[];
};

export type BrowserExtractor = (
  input: BrowserExtractionInput
) => Promise<BrowserExtractionResult>;

let activeBrowserJobs = 0;
const browserQueue: Array<() => void> = [];

export const defaultBrowserExtractor: BrowserExtractor = async (input) =>
  withBrowserSlot(input.config, () => extractWithPuppeteer(input));

async function extractWithPuppeteer(
  input: BrowserExtractionInput
): Promise<BrowserExtractionResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ["--disable-dev-shm-usage", "--no-sandbox"]
    });
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(input.config.BROWSER_TIMEOUT_MS);
    page.setDefaultTimeout(input.config.BROWSER_TIMEOUT_MS);

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      handleBrowserRequest(request, input).catch(() => {
        request.abort("blockedbyclient").catch(() => undefined);
      });
    });

    const response = await page.goto(input.url, {
      waitUntil: "networkidle2",
      timeout: input.config.BROWSER_TIMEOUT_MS
    });

    const title = await page.title();
    const text = await page.evaluate(() => document.body?.innerText ?? "");

    return {
      title: title.trim().length > 0 ? title.trim() : null,
      text: text.replace(/\s+/g, " ").trim(),
      finalUrl: response?.url() ?? page.url(),
      warnings: []
    };
  } finally {
    await page?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

async function handleBrowserRequest(
  request: HTTPRequest,
  input: BrowserExtractionInput
) {
  const blockedResourceTypes = new Set(["font", "image", "media"]);

  if (blockedResourceTypes.has(request.resourceType())) {
    await request.abort("blockedbyclient");
    return;
  }

  if (request.isNavigationRequest()) {
    const policyInput: UrlPolicyInput = {
      url: request.url(),
      allowedDomains: input.request.allowedDomains,
      blockedDomains: input.request.blockedDomains
    };
    await validateUrlPolicy(policyInput, input.config, {
      lookup: input.lookup
    });
  }

  await request.continue();
}

async function withBrowserSlot<T>(
  config: AppConfig,
  work: () => Promise<T>
): Promise<T> {
  if (activeBrowserJobs >= config.MAX_BROWSER_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      browserQueue.push(resolve);
    });
  }

  activeBrowserJobs += 1;

  try {
    return await work();
  } finally {
    activeBrowserJobs -= 1;
    browserQueue.shift()?.();
  }
}
