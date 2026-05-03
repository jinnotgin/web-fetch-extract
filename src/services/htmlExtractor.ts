import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";

export type HtmlExtractionResult = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  language: string | null;
  text: string;
  method: "readability" | "cheerio";
};

export function extractHtml(html: string, url: string): HtmlExtractionResult {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const metadata = extractMetadata(document);
  const article = new Readability(document.cloneNode(true) as Document).parse();
  const readableText = normalizeText(article?.textContent ?? "");

  if (readableText.length > 0) {
    return {
      ...metadata,
      title: article?.title?.trim() || metadata.title,
      text: readableText,
      method: "readability"
    };
  }

  return {
    ...metadata,
    text: extractVisibleText(html),
    method: "cheerio"
  };
}

function extractMetadata(document: Document) {
  return {
    title: document.title.trim() || null,
    description:
      document
        .querySelector('meta[name="description"], meta[property="og:description"]')
        ?.getAttribute("content")
        ?.trim() || null,
    canonicalUrl:
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ||
      null,
    language: document.documentElement.lang?.trim() || null
  };
}

function extractVisibleText(html: string): string {
  const $ = cheerio.load(html);
  $(
    "script, style, noscript, iframe, svg, nav, footer, header, aside, form"
  ).remove();

  return normalizeText($("body").text());
}

function normalizeText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
