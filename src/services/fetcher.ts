import type { AppConfig } from "../config.js";

export type FetchResult = {
  finalUrl: string;
  contentType: string;
  contentLength: number | null;
  body: Buffer;
};

export type FetchUrl = (url: string, config: AppConfig) => Promise<FetchResult>;

export const fetchUrl: FetchUrl = async (url, config) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": `WebFetchExtractService/${config.version}`,
      Accept: "text/html,application/pdf,text/plain,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.8"
    },
    signal: AbortSignal.timeout(config.REQUEST_TIMEOUT_MS)
  });

  const body = Buffer.from(await response.arrayBuffer());
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength =
    contentLengthHeader === null ? body.length : Number(contentLengthHeader);

  return {
    finalUrl: response.url || url,
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
    contentLength,
    body
  };
};
