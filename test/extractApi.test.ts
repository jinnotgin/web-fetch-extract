import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { FetchUrl } from "../src/services/fetcher.js";
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

function buildTestApp(fetchUrl: FetchUrl) {
  return buildApp({
    config: loadConfig({ NODE_ENV: "test", API_KEYS: "test-key" }),
    logger: false,
    services: {
      fetchUrl,
      urlPolicyLookup: publicLookup
    }
  });
}
