import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import type { ExtractRequest } from "../types/api.js";
import {
  isHtmlContentType,
  isPdfContentType,
  isPlainTextContentType
} from "../utils/mime.js";
import { chunkText } from "./chunker.js";
import { fetchUrl, type FetchUrl } from "./fetcher.js";
import { extractHtml } from "./htmlExtractor.js";
import { extractPdf } from "./pdfExtractor.js";

export type ExtractServiceOptions = {
  fetchUrl?: FetchUrl;
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
    input.config
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
      usedBrowser: false,
      usedOcr: false,
      pageCount: extracted.pageCount,
      pagesProcessed: extracted.pagesProcessed,
      durationMs: Math.round(performance.now() - startedAt)
    },
    limits: {
      truncated: warnings.includes("Text was truncated to maxTextChars."),
      maxBytes: input.request.maxBytes ?? null,
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
  config: AppConfig
) {
  if (isHtmlContentType(contentType)) {
    const text = body.toString("utf8");
    const extracted = extractHtml(text, finalUrl);
    return {
      title: extracted.title,
      description: extracted.description,
      language: extracted.language,
      text: extracted.text,
      method: extracted.method,
      pageCount: null,
      pagesProcessed: null,
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
      pageCount: null,
      pagesProcessed: null,
      pageRanges: [],
      warnings: []
    };
  }

  if (isPdfContentType(contentType)) {
    const extracted = await extractPdf(body, {
      maxPages: request.maxPages ?? config.MAX_PDF_PAGES
    });

    return {
      title: extracted.title,
      description: null,
      language: null,
      text: extracted.text,
      method: "pdfjs",
      pageCount: extracted.pageCount,
      pagesProcessed: extracted.pagesProcessed,
      pageRanges: extracted.pageRanges,
      warnings: extracted.warnings
    };
  }

  throw new AppError(415, "UNSUPPORTED_CONTENT_TYPE", "MIME type unsupported.", {
    contentType
  });
}

function limitText(text: string, maxTextChars: number, warnings: string[]) {
  if (text.length <= maxTextChars) {
    return text;
  }

  warnings.push("Text was truncated to maxTextChars.");
  return text.slice(0, maxTextChars);
}
