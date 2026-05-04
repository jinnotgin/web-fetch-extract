import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import Tesseract from "tesseract.js";

import type { PageRange } from "./chunker.js";

export type OcrImageInput = {
  body: Buffer;
  contentType: string;
};

export type OcrPdfInput = {
  body: Buffer;
  maxPages?: number;
};

export type OcrExtractionResult = {
  text: string;
  pagesOcred: number;
  durationMs: number;
  pageRanges: PageRange[];
  warnings: string[];
};

export type OcrExtractor = {
  extractImage(input: OcrImageInput): Promise<OcrExtractionResult>;
  extractPdfPages(input: OcrPdfInput): Promise<OcrExtractionResult>;
};

export const defaultOcrExtractor: OcrExtractor = {
  async extractImage(input) {
    const startedAt = performance.now();
    const text = await recognizeImage(input.body);

    return {
      text,
      pagesOcred: text.length > 0 ? 1 : 0,
      durationMs: Math.round(performance.now() - startedAt),
      pageRanges:
        text.length > 0
          ? [{ pageNumber: 1, charStart: 0, charEnd: text.length }]
          : [],
      warnings: text.length > 0 ? [] : ["OCR returned no text."]
    };
  },

  async extractPdfPages(input) {
    const startedAt = performance.now();
    const document = await getDocument({
      data: new Uint8Array(input.body),
      disableFontFace: true,
      useSystemFonts: true
    }).promise;
    const pagesToOcr =
      input.maxPages === undefined ? document.numPages : Math.min(document.numPages, input.maxPages);
    const pageTexts: string[] = [];
    const pageRanges: PageRange[] = [];
    let cursor = 0;

    for (let pageNumber = 1; pageNumber <= pagesToOcr; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(viewport.width, viewport.height);

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport
      }).promise;

      const text = await recognizeImage(canvas.toBuffer("image/png"));
      const pageStart = cursor;
      pageTexts.push(text);
      cursor += text.length;
      pageRanges.push({
        pageNumber,
        charStart: pageStart,
        charEnd: cursor
      });

      if (pageNumber < pagesToOcr) {
        cursor += 2;
      }
    }

    await document.destroy();

    const text = pageTexts.join("\n\n").trim();
    const warnings: string[] = [];

    if (document.numPages > pagesToOcr) {
      warnings.push("OCR processing stopped at MAX_OCR_PAGES.");
    }

    if (text.length === 0) {
      warnings.push("OCR returned no text.");
    }

    return {
      text,
      pagesOcred: pagesToOcr,
      durationMs: Math.round(performance.now() - startedAt),
      pageRanges,
      warnings
    };
  }
};

async function recognizeImage(image: Buffer): Promise<string> {
  const result = await Tesseract.recognize(image, "eng");
  return result.data.text.replace(/\s+/g, " ").trim();
}
