import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import type { ExtractRequest } from "../types/api.js";
import {
  isHtmlContentType,
  isImageContentType,
  isPdfContentType,
  isPlainTextContentType
} from "../utils/mime.js";
import {
  defaultBrowserExtractor,
  type BrowserExtractor
} from "./browserExtractor.js";
import { chunkText } from "./chunker.js";
import { fetchUrl, type FetchUrl } from "./fetcher.js";
import { extractHtml } from "./htmlExtractor.js";
import {
  defaultOcrExtractor,
  type OcrExtractor,
  type OcrExtractionResult
} from "./ocrExtractor.js";
import { extractPdf } from "./pdfExtractor.js";
import type { DnsLookup } from "./urlPolicy.js";

export type ExtractServiceOptions = {
  fetchUrl?: FetchUrl;
  ocrExtractor?: OcrExtractor;
  browserExtractor?: BrowserExtractor;
  urlPolicyLookup?: DnsLookup;
};

export type ExtractServiceInput = {
  requestId: string;
  normalizedUrl: string;
  request: ExtractRequest;
  config: AppConfig;
};

export async function extractUrl(
  input: ExtractServiceInput,
  options: ExtractServiceOptions = {}
) {
  const startedAt = performance.now();
  const fetch = options.fetchUrl ?? fetchUrl;
  const fetched = await fetch(input.normalizedUrl, input.config);
  const contentType = fetched.contentType;
  const warnings: string[] = [];

  const extracted = await extractByContentType(
    contentType,
    fetched.body,
    fetched.finalUrl,
    input.request,
    input.config,
    options.ocrExtractor ?? defaultOcrExtractor,
    options.browserExtractor ?? defaultBrowserExtractor,
    options.urlPolicyLookup
  );
  warnings.push(...extracted.warnings);
  const limitedText = limitText(extracted.text, input.request.maxTextChars, warnings);
  const chunks = input.request.includeChunks
    ? chunkText(limitedText, {
        chunkSizeChars: input.request.chunkSizeChars,
        chunkOverlapChars: input.request.chunkOverlapChars,
        maxChunks: input.request.maxChunks
      }, extracted.pageRanges)
    : [];

  return {
    requestId: input.requestId,
    url: input.request.url,
    finalUrl: fetched.finalUrl,
    retrievedAt: new Date().toISOString(),
    contentType,
    contentLength: fetched.contentLength,
    title: extracted.title,
    description: extracted.description,
    language: extracted.language,
    extraction: {
      method: extracted.method,
      usedBrowser: extracted.usedBrowser,
      usedOcr: extracted.usedOcr,
      pageCount: extracted.pageCount,
      pagesProcessed: extracted.pagesProcessed,
      pagesOcred: extracted.pagesOcred,
      ocrDurationMs: extracted.ocrDurationMs,
      durationMs: Math.round(performance.now() - startedAt)
    },
    limits: {
      truncated: warnings.includes("Text was truncated to maxTextChars."),
      maxBytes: input.request.maxBytes ?? null,
      maxPages: effectiveMaxPages(
        input.request.maxPages,
        pageEnvironmentLimit(input.config, extracted.method, extracted.pageCount)
      ) ?? null,
      maxTextChars: input.request.maxTextChars,
      maxChunks: input.request.maxChunks
    },
    ...(input.request.includeRawText ? { text: limitedText } : {}),
    ...(input.request.includeChunks ? { chunks } : {}),
    warnings
  };
}

async function extractByContentType(
  contentType: string,
  body: Buffer,
  finalUrl: string,
  request: ExtractRequest,
  config: AppConfig,
  ocrExtractor: OcrExtractor,
  browserExtractor: BrowserExtractor,
  urlPolicyLookup?: DnsLookup
) {
  if (isHtmlContentType(contentType)) {
    const text = body.toString("utf8");
    const extracted = extractHtml(text, finalUrl);

    if (
      request.mode === "browser" &&
      (!config.ENABLE_BROWSER_FALLBACK || !request.useBrowserFallback)
    ) {
      throw new AppError(422, "EXTRACTION_FAILED", "Browser fallback is disabled.");
    }

    if (shouldUseBrowserFallback(request, config, extracted.text)) {
      const rendered = await browserExtractor({
        url: finalUrl,
        request,
        config,
        lookup: urlPolicyLookup
      });

      return {
        title: rendered.title,
        description: null,
        language: null,
        text: rendered.text,
        method: "browser",
        usedBrowser: true,
        usedOcr: false,
        pageCount: null,
        pagesProcessed: null,
        pagesOcred: 0,
        ocrDurationMs: null,
        pageRanges: [],
        warnings: rendered.warnings
      };
    }

    return {
      title: extracted.title,
      description: extracted.description,
      language: extracted.language,
      text: extracted.text,
      method: extracted.method,
      usedBrowser: false,
      usedOcr: false,
      pageCount: null,
      pagesProcessed: null,
      pagesOcred: 0,
      ocrDurationMs: null,
      pageRanges: [],
      warnings: []
    };
  }

  if (isPlainTextContentType(contentType)) {
    return {
      title: null,
      description: null,
      language: null,
      text: body.toString("utf8").trim(),
      method: "text",
      usedBrowser: false,
      usedOcr: false,
      pageCount: null,
      pagesProcessed: null,
      pagesOcred: 0,
      ocrDurationMs: null,
      pageRanges: [],
      warnings: []
    };
  }

  if (isPdfContentType(contentType)) {
    const pdfMaxPages = effectiveMaxPages(request.maxPages, config.MAX_PDF_PAGES);
    const extracted = await extractPdf(body, {
      maxPages: pdfMaxPages
    });

    if (
      extracted.text.length === 0 &&
      config.ENABLE_OCR &&
      request.useOcrFallback
    ) {
      const ocrMaxPages = effectiveMaxPages(request.maxPages, config.MAX_OCR_PAGES);
      const ocr = await ocrExtractor.extractPdfPages({
        body,
        maxPages: ocrMaxPages
      });

      return {
        title: extracted.title,
        description: null,
        language: null,
        text: ocr.text,
        method: "ocr",
        usedBrowser: false,
        usedOcr: true,
        pageCount: extracted.pageCount,
        pagesProcessed: extracted.pagesProcessed,
        pagesOcred: ocr.pagesOcred,
        ocrDurationMs: ocr.durationMs,
        pageRanges: ocr.pageRanges,
        warnings: [...extracted.warnings, ...ocr.warnings]
      };
    }

    return {
      title: extracted.title,
      description: null,
      language: null,
      text: extracted.text,
      method: "pdfjs",
      usedBrowser: false,
      usedOcr: false,
      pageCount: extracted.pageCount,
      pagesProcessed: extracted.pagesProcessed,
      pagesOcred: 0,
      ocrDurationMs: null,
      pageRanges: extracted.pageRanges,
      warnings: extracted.warnings
    };
  }

  if (isImageContentType(contentType)) {
    if (!config.ENABLE_OCR || !request.useOcrFallback) {
      throw new AppError(415, "UNSUPPORTED_CONTENT_TYPE", "OCR is disabled for image content.", {
        contentType
      });
    }

    const ocr = await ocrExtractor.extractImage({
      body,
      contentType
    });

    return fromOcrResult(ocr);
  }

  throw new AppError(415, "UNSUPPORTED_CONTENT_TYPE", "MIME type unsupported.", {
    contentType
  });
}

function effectiveMaxPages(
  requestMaxPages: number | undefined,
  environmentMaxPages: number | undefined
) {
  if (requestMaxPages === undefined) {
    return environmentMaxPages;
  }

  if (environmentMaxPages === undefined) {
    return requestMaxPages;
  }

  return Math.min(requestMaxPages, environmentMaxPages);
}

function pageEnvironmentLimit(
  config: AppConfig,
  method: string,
  pageCount: number | null
) {
  if (pageCount === null) {
    return undefined;
  }

  return method === "ocr" ? config.MAX_OCR_PAGES : config.MAX_PDF_PAGES;
}

function fromOcrResult(ocr: OcrExtractionResult) {
  return {
    title: null,
    description: null,
    language: null,
    text: ocr.text,
    method: "ocr",
    usedBrowser: false,
    usedOcr: true,
    pageCount: null,
    pagesProcessed: null,
    pagesOcred: ocr.pagesOcred,
    ocrDurationMs: ocr.durationMs,
    pageRanges: ocr.pageRanges,
    warnings: ocr.warnings
  };
}

function shouldUseBrowserFallback(
  request: ExtractRequest,
  config: AppConfig,
  text: string
) {
  if (!config.ENABLE_BROWSER_FALLBACK || !request.useBrowserFallback) {
    return false;
  }

  if (request.mode === "browser") {
    return true;
  }

  return request.mode === "auto" && text.trim().length < 100;
}

function limitText(text: string, maxTextChars: number, warnings: string[]) {
  if (text.length <= maxTextChars) {
    return text;
  }

  warnings.push("Text was truncated to maxTextChars.");
  return text.slice(0, maxTextChars);
}
