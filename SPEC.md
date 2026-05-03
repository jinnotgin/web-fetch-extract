# Web Fetch Extract Service Contract

This contract is derived from `agent-bootstrap-docs/web-fetch-extract-service-spec.md` and reflects the implemented service.

## Endpoints

- `GET /v1/health`
- `GET /v1/ready`
- `POST /v1/extract`

## Authentication

If `API_KEYS` is empty, extraction requests are unauthenticated. If `API_KEYS` is set, use `Authorization: Bearer <api-key>` or `x-api-key`.

## Extraction Inputs

`POST /v1/extract` accepts an absolute URL and optional controls:

- `mode`: `auto`, `html`, `pdf`, `text`, `image`, or `browser`
- `maxBytes`
- `maxPages`
- `maxTextChars`
- `chunkSizeChars`
- `chunkOverlapChars`
- `maxChunks`
- `useBrowserFallback`
- `useOcrFallback`
- `allowedDomains`
- `blockedDomains`
- `includeRawText`
- `includeChunks`
- `metadataOnly`

## Extraction Outputs

Responses include request ID, original URL, final URL, retrieval time, content type/length, metadata, extraction details, limits, optional text, optional chunks, and warnings.

Chunks include character offsets and may include `pageStart` / `pageEnd` for PDF or OCR-derived content.

## Implemented Extraction Methods

- `readability` / `html` for HTML pages
- `text` for `text/plain`
- `pdfjs` for text-layer PDFs
- `ocr` for image URLs and empty-text PDFs when OCR is enabled
- `browser` for low-text HTML or forced browser mode when browser fallback is enabled

## Safety Model

The service enforces URL scheme, DNS/IP, domain, redirect, timeout, page, OCR, browser, text, and chunk limits. API key auth is enforced only when `API_KEYS` is configured. It does not forward arbitrary caller headers.
