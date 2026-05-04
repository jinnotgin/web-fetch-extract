import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PageRange } from "./chunker.js";

export type PdfExtractionResult = {
  title: string | null;
  text: string;
  pageCount: number;
  pagesProcessed: number;
  pageRanges: PageRange[];
  warnings: string[];
};

export async function extractPdf(
  body: Buffer,
  options: { maxPages?: number }
): Promise<PdfExtractionResult> {
  const document = await getDocument({
    data: new Uint8Array(body),
    disableFontFace: true,
    useSystemFonts: true
  }).promise;

  const metadata = await document.getMetadata().catch(() => null);
  const title =
    typeof metadata?.info === "object" &&
    metadata.info !== null &&
    "Title" in metadata.info &&
    typeof metadata.info.Title === "string" &&
    metadata.info.Title.trim().length > 0
      ? metadata.info.Title.trim()
      : null;

  const pageCount = document.numPages;
  const pagesProcessed =
    options.maxPages === undefined ? pageCount : Math.min(pageCount, options.maxPages);
  const pageRanges: PageRange[] = [];
  const pageTexts: string[] = [];
  let cursor = 0;

  for (let pageNumber = 1; pageNumber <= pagesProcessed; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const textItems: string[] = [];

    for (const item of content.items) {
      if ("str" in item) {
        textItems.push(item.str);
      }
    }

    const text = textItems
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const pageStart = cursor;
    pageTexts.push(text);
    cursor += text.length;
    pageRanges.push({
      pageNumber,
      charStart: pageStart,
      charEnd: cursor
    });

    if (pageNumber < pagesProcessed) {
      cursor += 2;
    }
  }

  const text = pageTexts.join("\n\n").trim();
  const warnings: string[] = [];

  if (pageCount > pagesProcessed) {
    warnings.push("PDF processing stopped at maxPages.");
  }

  if (text.length < 20) {
    warnings.push("PDF text layer is empty or low confidence.");
  }

  await document.destroy();

  return {
    title,
    text,
    pageCount,
    pagesProcessed,
    pageRanges,
    warnings
  };
}
