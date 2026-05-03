import type { Chunk } from "../types/api.js";

export type ChunkOptions = {
  chunkSizeChars: number;
  chunkOverlapChars: number;
  maxChunks: number;
};

export type PageRange = {
  pageNumber: number;
  charStart: number;
  charEnd: number;
};

export function chunkText(
  text: string,
  options: ChunkOptions,
  pageRanges: PageRange[] = []
): Chunk[] {
  const normalized = text.trim();

  if (normalized.length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let start = 0;

  while (start < normalized.length && chunks.length < options.maxChunks) {
    const hardEnd = Math.min(start + options.chunkSizeChars, normalized.length);
    const end = chooseBoundary(normalized, start, hardEnd);
    const chunkTextValue = normalized.slice(start, end).trim();

    if (chunkTextValue.length > 0) {
      const pageSpan = getPageSpan(start, end, pageRanges);
      chunks.push({
        index: chunks.length,
        text: chunkTextValue,
        charStart: start,
        charEnd: end,
        ...(pageSpan ? pageSpan : {})
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - options.chunkOverlapChars);

    if (start >= end) {
      start = end;
    }
  }

  return chunks;
}

function getPageSpan(
  chunkStart: number,
  chunkEnd: number,
  pageRanges: PageRange[]
): Pick<Chunk, "pageStart" | "pageEnd"> | null {
  const overlapping = pageRanges.filter(
    (pageRange) =>
      pageRange.charStart < chunkEnd && pageRange.charEnd > chunkStart
  );

  if (overlapping.length === 0) {
    return null;
  }

  return {
    pageStart: overlapping[0]?.pageNumber,
    pageEnd: overlapping[overlapping.length - 1]?.pageNumber
  };
}

function chooseBoundary(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) {
    return text.length;
  }

  const window = text.slice(start, hardEnd);
  const boundaryPatterns = ["\n\n", ". ", "\n", " "];

  for (const pattern of boundaryPatterns) {
    const index = window.lastIndexOf(pattern);

    if (index > Math.floor(window.length * 0.5)) {
      return start + index + pattern.length;
    }
  }

  return hardEnd;
}
