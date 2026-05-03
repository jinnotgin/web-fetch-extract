import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { extractHtml } from "../src/services/htmlExtractor.js";

describe("extractHtml", () => {
  it("extracts article metadata and readable text", async () => {
    const html = await readFile("test/fixtures/sample.html", "utf8");
    const result = extractHtml(html, "https://example.com/sample");

    expect(result).toMatchObject({
      title: "Sample Article",
      description: "A concise sample article for extraction tests.",
      canonicalUrl: "https://example.com/sample",
      language: "en"
    });
    expect(result.text).toContain("first paragraph of useful readable content");
    expect(result.text).toContain("second paragraph with enough text");
    expect(result.text).not.toContain("window.secret");
    expect(result.text).not.toContain("Home Pricing Login");
  });
});
