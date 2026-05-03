import { describe, expect, it } from "vitest";

import { chunkText } from "../src/services/chunker.js";

describe("chunkText", () => {
  it("returns one chunk for short text", () => {
    expect(
      chunkText("Short readable text.", {
        chunkSizeChars: 100,
        chunkOverlapChars: 10,
        maxChunks: 5
      })
    ).toEqual([
      {
        index: 0,
        text: "Short readable text.",
        charStart: 0,
        charEnd: 20
      }
    ]);
  });

  it("chunks long text with overlap and max chunk limit", () => {
    const chunks = chunkText("Paragraph one.\n\nParagraph two is longer.\n\nParagraph three.", {
      chunkSizeChars: 24,
      chunkOverlapChars: 4,
      maxChunks: 2
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      index: 0,
      charStart: 0
    });
    expect(chunks[1]?.charStart).toBeLessThan(chunks[0]?.charEnd ?? 0);
  });

  it("annotates chunks with overlapping PDF page ranges", () => {
    const chunks = chunkText(
      "Page one has useful content. Page two has more useful content.",
      {
        chunkSizeChars: 42,
        chunkOverlapChars: 0,
        maxChunks: 5
      },
      [
        { pageNumber: 1, charStart: 0, charEnd: 28 },
        { pageNumber: 2, charStart: 28, charEnd: 61 }
      ]
    );

    expect(chunks[0]).toMatchObject({
      pageStart: 1,
      pageEnd: 2
    });
    expect(chunks[1]).toMatchObject({
      pageStart: 2,
      pageEnd: 2
    });
  });
});
