export type ExtractMode = "auto" | "html" | "pdf" | "text" | "image" | "browser";

export type ExtractRequest = {
  url: string;
  mode: ExtractMode;
  maxBytes?: number;
  maxPages?: number;
  maxTextChars: number;
  chunkSizeChars: number;
  chunkOverlapChars: number;
  maxChunks: number;
  useBrowserFallback: boolean;
  useOcrFallback: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  includeRawText: boolean;
  includeChunks: boolean;
  metadataOnly: boolean;
};

export type Chunk = {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageStart?: number;
  pageEnd?: number;
};
