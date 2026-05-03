import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { BrowserExtractor } from "../src/services/browserExtractor.js";
import type { FetchUrl } from "../src/services/fetcher.js";
import type { OcrExtractor } from "../src/services/ocrExtractor.js";
import type { DnsLookup } from "../src/services/urlPolicy.js";

const publicLookup: DnsLookup = () =>
  Promise.resolve([{ address: "93.184.216.34", family: 4 }]);

describe("extract API", () => {
  it("extracts HTML through the API", async () => {
    const html = await readFile("test/fixtures/sample.html");
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: "https://example.com/sample",
        contentType: "text/html; charset=utf-8",
        contentLength: html.length,
        body: html
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/sample",
        includeRawText: true,
        includeChunks: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      url: "https://example.com/sample",
      finalUrl: "https://example.com/sample",
      contentType: "text/html; charset=utf-8",
      title: "Sample Article",
      extraction: {
        method: "readability",
        usedBrowser: false,
        usedOcr: false
      },
      chunks: [
        {
          index: 0
        }
      ],
      warnings: []
    });
    const payload = response.json<{ text: string }>();
    expect(payload.text).toContain("useful readable content");
  });

  it.each([
    {
      fixture: "test/fixtures/web-html/w3c-wcag21.html",
      url: "https://www.w3.org/TR/WCAG21/",
      title: "Web Content Accessibility Guidelines (WCAG) 2.1",
      expectedText: "wide range of recommendations for making web content more accessible"
    },
    {
      fixture: "test/fixtures/web-html/w3c-berners-lee.html",
      url: "https://www.w3.org/People/Berners-Lee/",
      title: "Tim Berners-Lee",
      expectedText: "invented the World Wide Web"
    }
  ])("extracts downloaded HTML fixture $fixture", async (sample) => {
    const html = await readFile(sample.fixture);
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: sample.url,
        contentType: "text/html; charset=utf-8",
        contentLength: html.length,
        body: html
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: sample.url,
        includeRawText: true,
        includeChunks: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      finalUrl: sample.url,
      title: sample.title,
      extraction: {
        usedBrowser: false,
        usedOcr: false
      }
    });
    const payload = response.json<{ chunks: unknown[]; text: string }>();
    expect(payload.text).toContain(sample.expectedText);
    expect(payload.chunks.length).toBeGreaterThan(0);
  });

  it("uses browser fallback for low-text HTML when enabled", async () => {
    const html = Buffer.from("<html><head><title>Shell</title></head><body></body></html>");
    let browserCalled = false;
    const app = buildTestApp(
      () =>
        Promise.resolve({
          finalUrl: "https://example.com/rendered",
          contentType: "text/html; charset=utf-8",
          contentLength: html.length,
          body: html
        }),
      {
        browserExtractor: () => {
          browserCalled = true;
          return Promise.resolve({
            title: "Rendered Page",
            text: "Rendered page content produced by JavaScript.",
            finalUrl: "https://example.com/rendered",
            warnings: []
          });
        }
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/rendered"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(browserCalled).toBe(true);
    expect(response.json()).toMatchObject({
      title: "Rendered Page",
      extraction: {
        method: "browser",
        usedBrowser: true
      },
      text: "Rendered page content produced by JavaScript."
    });
  });

  it("does not use browser fallback when the request disables it", async () => {
    const html = Buffer.from("<html><head><title>Shell</title></head><body></body></html>");
    let browserCalled = false;
    const app = buildTestApp(
      () =>
        Promise.resolve({
          finalUrl: "https://example.com/rendered",
          contentType: "text/html; charset=utf-8",
          contentLength: html.length,
          body: html
        }),
      {
        browserExtractor: () => {
          browserCalled = true;
          return Promise.resolve({
            title: "Rendered Page",
            text: "Rendered page content produced by JavaScript.",
            finalUrl: "https://example.com/rendered",
            warnings: []
          });
        }
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/rendered",
        useBrowserFallback: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(browserCalled).toBe(false);
    expect(response.json()).toMatchObject({
      extraction: {
        usedBrowser: false
      }
    });
  });

  it("rejects forced browser mode when globally disabled", async () => {
    const html = Buffer.from("<html><head><title>Shell</title></head><body></body></html>");
    const app = buildTestApp(
      () =>
        Promise.resolve({
          finalUrl: "https://example.com/rendered",
          contentType: "text/html; charset=utf-8",
          contentLength: html.length,
          body: html
        }),
      {
        configEnv: {
          ENABLE_BROWSER_FALLBACK: "false"
        }
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/rendered",
        mode: "browser"
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: {
        code: "EXTRACTION_FAILED"
      }
    });
  });

  it("extracts direct image URLs with OCR when enabled", async () => {
    const ocrExtractor = fakeOcrExtractor({
      imageText: "Text recognized from a fixture image."
    });
    const app = buildTestApp(
      () =>
        Promise.resolve({
          finalUrl: "https://example.com/image.png",
          contentType: "image/png",
          contentLength: 7,
          body: Buffer.from("fakepng")
        }),
      { ocrExtractor }
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/image.png"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      extraction: {
        method: "ocr",
        usedOcr: true,
        pagesOcred: 1,
        ocrDurationMs: 12
      },
      text: "Text recognized from a fixture image."
    });
  });

  it("rejects direct image OCR when request OCR fallback is disabled", async () => {
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: "https://example.com/image.png",
        contentType: "image/png",
        contentLength: 7,
        body: Buffer.from("fakepng")
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/image.png",
        useOcrFallback: false
      }
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      error: {
        code: "UNSUPPORTED_CONTENT_TYPE"
      }
    });
  });

  it("extracts plain text through the API", async () => {
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: "https://example.com/readme.txt",
        contentType: "text/plain; charset=utf-8",
        contentLength: 25,
        body: Buffer.from("Plain text document body.")
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/readme.txt"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      title: null,
      text: "Plain text document body.",
      extraction: {
        method: "text",
        usedBrowser: false,
        usedOcr: false
      }
    });
  });

  it("extracts a text-layer PDF through the API", async () => {
    const pdf = await readFile("test/fixtures/sample.pdf");
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: "https://example.com/sample.pdf",
        contentType: "application/pdf",
        contentLength: pdf.length,
        body: pdf
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/sample.pdf",
        maxPages: 1,
        chunkSizeChars: 1000
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      finalUrl: "https://example.com/sample.pdf",
      contentType: "application/pdf",
      extraction: {
        method: "pdfjs",
        usedBrowser: false,
        usedOcr: false,
        pageCount: 2,
        pagesProcessed: 1
      },
      chunks: [
        {
          index: 0,
          pageStart: 1,
          pageEnd: 1
        }
      ],
      warnings: ["PDF processing stopped at maxPages."]
    });
    const payload = response.json<{ text: string }>();
    expect(payload.text).toContain("First PDF page has embedded readable text");
    expect(payload.text).not.toContain("Second PDF page");
  });

  it.each([
    {
      fixture: "test/fixtures/web-pdf/w3c-dummy.pdf",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      expectedText: "Dummy PDF file"
    },
    {
      fixture: "test/fixtures/web-pdf/orimi-pdf-test.pdf",
      url: "https://orimi.com/pdf-test.pdf",
      expectedText: "Congratulations, your computer is equipped with a PDF"
    }
  ])("extracts downloaded PDF fixture $fixture", async (sample) => {
    const pdf = await readFile(sample.fixture);
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: sample.url,
        contentType: "application/pdf",
        contentLength: pdf.length,
        body: pdf
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: sample.url,
        includeRawText: true,
        includeChunks: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      finalUrl: sample.url,
      contentType: "application/pdf",
      extraction: {
        method: "pdfjs",
        pageCount: 1,
        pagesProcessed: 1
      }
    });
    const payload = response.json<{ chunks: unknown[]; text: string }>();
    expect(payload.text).toContain(sample.expectedText);
    expect(payload.chunks.length).toBeGreaterThan(0);
  });

  it("OCRs scanned PDFs up to the configured OCR page limit", async () => {
    const pdf = await readFile("test/fixtures/scanned-empty.pdf");
    let receivedMaxPages = 0;
    const ocrExtractor = fakeOcrExtractor({
      pdfText: "OCR text from scanned page one.",
      pdfPagesOcred: 1,
      onPdfInput(input) {
        receivedMaxPages = input.maxPages;
      }
    });
    const app = buildTestApp(
      () =>
        Promise.resolve({
          finalUrl: "https://example.com/scanned.pdf",
          contentType: "application/pdf",
          contentLength: pdf.length,
          body: pdf
        }),
      {
        configEnv: {
          MAX_OCR_PAGES: "1"
        },
        ocrExtractor
      }
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/scanned.pdf",
        maxPages: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(receivedMaxPages).toBe(1);
    expect(response.json()).toMatchObject({
      extraction: {
        method: "ocr",
        usedOcr: true,
        pageCount: 2,
        pagesProcessed: 2,
        pagesOcred: 1,
        ocrDurationMs: 34
      },
      text: "OCR text from scanned page one."
    });
  });

  it("rejects unsupported content types", async () => {
    const app = buildTestApp(() =>
      Promise.resolve({
        finalUrl: "https://example.com/data.bin",
        contentType: "application/octet-stream",
        contentLength: 3,
        body: Buffer.from([1, 2, 3])
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {
        url: "https://example.com/data.bin"
      }
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      error: {
        code: "UNSUPPORTED_CONTENT_TYPE"
      }
    });
  });
});

function buildTestApp(
  fetchUrl: FetchUrl,
  options: {
    configEnv?: NodeJS.ProcessEnv;
    ocrExtractor?: OcrExtractor;
    browserExtractor?: BrowserExtractor;
  } = {}
) {
  return buildApp({
    config: loadConfig({
      NODE_ENV: "test",
      API_KEYS: "test-key",
      ...options.configEnv
    }),
    logger: false,
    services: {
      fetchUrl,
      ocrExtractor: options.ocrExtractor,
      browserExtractor: options.browserExtractor,
      urlPolicyLookup: publicLookup
    }
  });
}

function fakeOcrExtractor(options: {
  imageText?: string;
  pdfText?: string;
  pdfPagesOcred?: number;
  onPdfInput?: (input: { body: Buffer; maxPages: number }) => void;
}): OcrExtractor {
  return {
    extractImage() {
      const text = options.imageText ?? "";
      return Promise.resolve({
        text,
        pagesOcred: text.length > 0 ? 1 : 0,
        durationMs: 12,
        pageRanges:
          text.length > 0
            ? [{ pageNumber: 1, charStart: 0, charEnd: text.length }]
            : [],
        warnings: []
      });
    },
    extractPdfPages(input) {
      options.onPdfInput?.(input);
      const text = options.pdfText ?? "";
      return Promise.resolve({
        text,
        pagesOcred: options.pdfPagesOcred ?? 0,
        durationMs: 34,
        pageRanges:
          text.length > 0
            ? [{ pageNumber: 1, charStart: 0, charEnd: text.length }]
            : [],
        warnings: []
      });
    }
  };
}
