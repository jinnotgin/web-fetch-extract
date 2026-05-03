# Web Fetch + Document Extraction Service — Blank Repo Implementation Spec

**Status:** Implementation-ready  
**Target repo state:** Empty/blank repository  
**Primary language:** Node.js / TypeScript  
**Runtime target:** Dockerized HTTP service  
**Deployment target:** Google Cloud Run or any OCI-compatible runtime  
**CI target:** GitHub Actions with native Linux `amd64` and native Linux `arm64` builds  
**Container registry target:** GitHub Container Registry (`ghcr.io`) by default

---

## 1. Purpose

Build a managed Docker service that fetches public URLs and extracts readable text from:

- HTML web pages
- PDF documents with embedded text
- scanned PDFs and image-based documents via OCR fallback
- JavaScript-rendered pages via browser fallback

This service is intended to replace or approximate a managed `web_fetch`-style capability when using model providers or deployment platforms where native managed web fetch is unavailable or insufficient.

Anthropic's Web Fetch tool may be used as a general conceptual reference only. This repository must implement a provider-neutral service with its own API, safety controls, extraction pipeline, observability, and container build pipeline.

---

## 2. Non-goals

This service must **not**:

- act as an unrestricted proxy
- expose arbitrary browser automation to model output
- fetch private/internal network resources
- bypass paywalls, authentication, bot protections, or access controls
- persist fetched content unless explicitly enabled later
- provide a general web search engine
- run untrusted JavaScript outside a sandboxed browser process
- allow arbitrary request headers from clients or AI agents
- allow the model to dynamically construct hidden/exfiltration URLs

---

## 3. High-level architecture

```text
Caller / AI orchestration layer
        |
        | POST /v1/extract
        v
Web Fetch Extract Service
        |
        +-- URL validation and policy checks
        |
        +-- Plain HTTP fetch
        |
        +-- Content-type detection
        |
        +-- HTML extractor
        |     - Readability / Cheerio
        |
        +-- PDF text extractor
        |     - PDF.js or wrapper
        |
        +-- OCR fallback
        |     - render page images
        |     - Tesseract.js
        |
        +-- Browser fallback
              - Puppeteer
              - strict timeout/resource limits
```

---

## 4. Recommended repository structure

The agent must create the following structure:

```text
.
├── .dockerignore
├── .editorconfig
├── .env.example
├── .github
│   └── workflows
│       ├── ci.yml
│       ├── docker-native.yml
│       └── release.yml
├── .gitignore
├── Dockerfile
├── LICENSE
├── README.md
├── SECURITY.md
├── SPEC.md
├── openapi.yaml
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── src
│   ├── app.ts
│   ├── server.ts
│   ├── config.ts
│   ├── errors.ts
│   ├── routes
│   │   ├── health.ts
│   │   └── extract.ts
│   ├── schemas
│   │   └── extract.ts
│   ├── services
│   │   ├── extractService.ts
│   │   ├── fetcher.ts
│   │   ├── htmlExtractor.ts
│   │   ├── pdfExtractor.ts
│   │   ├── ocrExtractor.ts
│   │   ├── browserExtractor.ts
│   │   ├── chunker.ts
│   │   └── urlPolicy.ts
│   ├── utils
│   │   ├── dns.ts
│   │   ├── mime.ts
│   │   ├── logger.ts
│   │   └── timing.ts
│   └── types
│       └── api.ts
└── test
    ├── fixtures
    │   ├── sample.html
    │   └── sample.pdf
    ├── urlPolicy.test.ts
    ├── chunker.test.ts
    ├── extractHtml.test.ts
    └── health.test.ts
```

---

## 5. Technology choices

Use:

- Node.js 22 LTS or current active LTS
- TypeScript
- Fastify for the HTTP server
- Zod for request/response validation
- Undici for HTTP fetching
- Cheerio for HTML cleanup
- `jsdom` + `@mozilla/readability` for article-style extraction
- `pdfjs-dist` or a maintained PDF.js wrapper for PDF text extraction
- Tesseract.js for OCR fallback
- Puppeteer for browser fallback
- Pino for structured logs
- Vitest for tests
- ESLint for linting
- Docker multi-stage build
- GitHub Actions
- GHCR image publishing

Preferred dependencies:

```json
{
  "dependencies": {
    "@fastify/cors": "latest",
    "@fastify/helmet": "latest",
    "@fastify/rate-limit": "latest",
    "@mozilla/readability": "latest",
    "cheerio": "latest",
    "dotenv": "latest",
    "fastify": "latest",
    "jsdom": "latest",
    "pino": "latest",
    "pino-pretty": "latest",
    "puppeteer": "latest",
    "tesseract.js": "latest",
    "undici": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/jsdom": "latest",
    "@types/node": "latest",
    "@typescript-eslint/eslint-plugin": "latest",
    "@typescript-eslint/parser": "latest",
    "eslint": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

The implementation may add small utility libraries where justified, but must avoid large frameworks unless needed.

---

## 6. Runtime configuration

Create `.env.example`:

```bash
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Auth
API_KEYS=change-me-local-dev-key

# Fetch policy
ALLOW_HTTP=false
ALLOW_PRIVATE_IPS=false
MAX_REDIRECTS=5
REQUEST_TIMEOUT_MS=15000
BROWSER_TIMEOUT_MS=25000
MAX_RESPONSE_BYTES=25000000
MAX_TEXT_CHARS=500000
MAX_CHUNKS=80
CHUNK_SIZE_CHARS=6000
CHUNK_OVERLAP_CHARS=500

# PDF/OCR policy
MAX_PDF_PAGES=30
MAX_OCR_PAGES=5
ENABLE_OCR=true
ENABLE_BROWSER_FALLBACK=true

# Domain controls. Comma-separated. Empty means no allowlist.
ALLOWED_DOMAINS=
BLOCKED_DOMAINS=localhost,127.0.0.1,169.254.169.254
```

Environment variables must be parsed and validated on boot. Invalid configuration must fail fast.

---

## 7. Security requirements

The URL fetcher is security-sensitive. Implement these controls before any extraction logic is considered complete.

### 7.1 URL scheme policy

Allowed by default:

- `https:`

Optional only if `ALLOW_HTTP=true`:

- `http:`

Always reject:

- `file:`
- `ftp:`
- `gopher:`
- `data:`
- `blob:`
- `ws:`
- `wss:`
- unknown schemes

### 7.2 SSRF prevention

The service must block requests to:

- `localhost`
- `127.0.0.0/8`
- `::1`
- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- link-local ranges
- multicast ranges
- cloud metadata IPs, especially `169.254.169.254`

The service must:

1. parse and normalize the URL
2. resolve hostname DNS before connecting
3. reject blocked IP ranges
4. perform the request
5. inspect each redirect target
6. re-resolve DNS after each redirect
7. reject redirect chains to blocked hosts or IPs

### 7.3 Header policy

The service must not allow callers or model agents to provide arbitrary headers.

Allowed outbound headers:

```text
User-Agent: WebFetchExtractService/<version>
Accept: text/html,application/pdf,text/plain,application/xhtml+xml,*/*
Accept-Language: en-US,en;q=0.8
```

Do not forward:

- cookies
- authorization headers
- internal tracing headers from external clients
- custom client-supplied headers

### 7.4 Resource limits

Enforce:

- max redirects
- max response bytes
- request timeout
- browser timeout
- max extracted text chars
- max PDF pages
- max OCR pages
- max output chunks
- max concurrent browser jobs

### 7.5 Domain filtering

Support:

- `ALLOWED_DOMAINS`
- `BLOCKED_DOMAINS`
- per-request `allowedDomains`
- per-request `blockedDomains`

Per-request domain filters must only be more restrictive than global policy. A request must not be allowed to override global blocks.

Domain matching rules:

- exact domain match
- subdomain match if configured as `*.example.com`
- normalized lowercase hostnames
- punycode-normalized international hostnames

### 7.6 Browser sandboxing

Puppeteer must be used only as fallback and must run with strict constraints.

Required Chromium behavior:

- no file downloads
- no persistent profile
- no extensions
- JavaScript enabled only inside browser fallback
- block unnecessary resource types where possible:
  - media
  - fonts
  - large images unless screenshot/OCR path needs them
- block navigation to disallowed URLs
- timeout all navigation
- close browser/page in `finally`

In Cloud Run, do not use a privileged container.

---

## 8. Extraction pipeline

### 8.1 Main decision flow

```text
POST /v1/extract
  |
  +-- validate body
  +-- authenticate
  +-- normalize URL
  +-- apply URL policy
  +-- plain HTTP fetch
  +-- determine content type
      |
      +-- text/html or xhtml
      |     +-- extract with Readability
      |     +-- fallback to Cheerio visible text
      |     +-- if text too small and browser fallback enabled:
      |             use Puppeteer
      |
      +-- application/pdf
      |     +-- extract embedded text with PDF.js
      |     +-- if text too small and OCR enabled:
      |             OCR first N pages
      |
      +-- text/plain
      |     +-- return text directly
      |
      +-- image/*
      |     +-- OCR if enabled
      |
      +-- unsupported
            +-- return 415-style API error
```

### 8.2 HTML extraction

The HTML extractor must return:

- title
- description if available
- main readable text
- canonical URL if available
- language if available
- extraction method

Extraction priority:

1. `@mozilla/readability`
2. semantic HTML cleanup using Cheerio
3. plain visible text fallback

Remove:

- script
- style
- noscript
- iframe
- SVG
- navigation
- footer
- cookie banners where easily identifiable

### 8.3 PDF extraction

The PDF extractor must:

- accept a Buffer
- inspect page count
- stop at `maxPages`
- extract text per page
- preserve page numbers in chunks
- report whether text layer was empty or low confidence

If PDF.js extraction yields insufficient text, use OCR fallback only if enabled.

### 8.4 OCR extraction

OCR must be used only when necessary because it is CPU-heavy.

OCR applies to:

- scanned PDF pages rendered to images
- direct image URLs

OCR response metadata must include:

- OCR enabled/disabled
- pages OCRed
- OCR duration
- warnings when OCR is partial

### 8.5 Browser fallback

Use Puppeteer only when:

- content type is HTML
- plain HTTP extraction produces too little text
- request option `useBrowserFallback` is true
- global `ENABLE_BROWSER_FALLBACK=true`

Browser fallback must return:

- rendered page title
- rendered text
- final URL
- extraction method `browser`

---

## 9. Chunking behavior

Extracted text must be chunked before returning.

Default:

- `chunkSizeChars`: 6000
- `chunkOverlapChars`: 500
- `maxChunks`: 80

Each chunk must include:

- index
- text
- charStart
- charEnd
- optional pageStart
- optional pageEnd

Chunk boundaries should prefer:

1. headings
2. paragraph breaks
3. sentence boundaries
4. hard character limit

---

## 10. HTTP API specification

The service exposes a versioned REST API.

Base path:

```text
/v1
```

Authentication:

```http
Authorization: Bearer <api-key>
```

Alternative development-only authentication:

```http
x-api-key: <api-key>
```

If `API_KEYS` is empty in local development, authentication may be disabled. In production, the server must fail boot if `API_KEYS` is empty.

---

## 11. Endpoint: health check

### `GET /v1/health`

Liveness endpoint.

Response:

```json
{
  "ok": true,
  "service": "web-fetch-extract",
  "version": "0.1.0"
}
```

Status codes:

- `200` healthy

---

## 12. Endpoint: readiness check

### `GET /v1/ready`

Readiness endpoint.

Response:

```json
{
  "ready": true,
  "checks": {
    "config": true,
    "extractors": true
  }
}
```

Status codes:

- `200` ready
- `503` not ready

---

## 13. Endpoint: extract URL

### `POST /v1/extract`

Fetch and extract readable text from a URL.

### Request body

```json
{
  "url": "https://example.com/file.pdf",
  "mode": "auto",
  "maxBytes": 25000000,
  "maxPages": 20,
  "maxTextChars": 250000,
  "chunkSizeChars": 6000,
  "chunkOverlapChars": 500,
  "maxChunks": 80,
  "useBrowserFallback": true,
  "useOcrFallback": true,
  "allowedDomains": ["example.com", "*.example.org"],
  "blockedDomains": ["private.example.com"],
  "includeRawText": true,
  "includeChunks": true,
  "metadataOnly": false
}
```

### Request fields

| Field | Type | Required | Default | Description |
|---|---:|---:|---:|---|
| `url` | string | yes | none | Absolute URL to fetch. |
| `mode` | enum | no | `auto` | `auto`, `html`, `pdf`, `text`, `image`, or `browser`. |
| `maxBytes` | integer | no | env default | Maximum response size in bytes. |
| `maxPages` | integer | no | env default | Maximum PDF pages to process. |
| `maxTextChars` | integer | no | env default | Maximum extracted text characters. |
| `chunkSizeChars` | integer | no | env default | Target chunk size. |
| `chunkOverlapChars` | integer | no | env default | Chunk overlap size. |
| `maxChunks` | integer | no | env default | Maximum chunks returned. |
| `useBrowserFallback` | boolean | no | env default | Whether browser fallback is allowed. |
| `useOcrFallback` | boolean | no | env default | Whether OCR fallback is allowed. |
| `allowedDomains` | string[] | no | empty | Per-request allowlist, stricter than global policy. |
| `blockedDomains` | string[] | no | empty | Per-request blocklist, additive with global policy. |
| `includeRawText` | boolean | no | true | Include full extracted text, subject to limits. |
| `includeChunks` | boolean | no | true | Include chunk list. |
| `metadataOnly` | boolean | no | false | Fetch only metadata when possible. |

### Successful response

```json
{
  "requestId": "req_01HX0000000000000000000000",
  "url": "https://example.com/file.pdf",
  "finalUrl": "https://example.com/file.pdf",
  "retrievedAt": "2026-05-03T00:00:00.000Z",
  "contentType": "application/pdf",
  "contentLength": 123456,
  "title": "Example PDF",
  "description": null,
  "language": "en",
  "extraction": {
    "method": "pdfjs",
    "usedBrowser": false,
    "usedOcr": false,
    "pageCount": 12,
    "pagesProcessed": 12,
    "durationMs": 840
  },
  "limits": {
    "truncated": false,
    "maxBytes": 25000000,
    "maxTextChars": 250000,
    "maxChunks": 80
  },
  "text": "Full extracted text...",
  "chunks": [
    {
      "index": 0,
      "text": "Chunk text...",
      "charStart": 0,
      "charEnd": 5999,
      "pageStart": 1,
      "pageEnd": 2
    }
  ],
  "warnings": []
}
```

### Error response

```json
{
  "requestId": "req_01HX0000000000000000000000",
  "error": {
    "code": "URL_BLOCKED",
    "message": "The requested URL is blocked by policy.",
    "details": {
      "reason": "private_ip_range"
    }
  }
}
```

### Error codes

| HTTP Status | Code | Meaning |
|---:|---|---|
| `400` | `INVALID_REQUEST` | Request schema failed validation. |
| `400` | `INVALID_URL` | URL is malformed or unsupported. |
| `401` | `UNAUTHORIZED` | Missing or invalid API key. |
| `403` | `URL_BLOCKED` | URL blocked by policy. |
| `408` | `FETCH_TIMEOUT` | Fetch or browser operation timed out. |
| `413` | `RESPONSE_TOO_LARGE` | Response exceeded max byte limit. |
| `415` | `UNSUPPORTED_CONTENT_TYPE` | MIME type unsupported. |
| `422` | `EXTRACTION_FAILED` | Fetch succeeded but extraction failed. |
| `429` | `RATE_LIMITED` | Request exceeded rate limit. |
| `500` | `INTERNAL_ERROR` | Unexpected server error. |
| `502` | `UPSTREAM_ERROR` | Remote server returned an unusable response. |

---

## 14. Endpoint: fetch metadata only

### `POST /v1/metadata`

Fetch lightweight metadata from a URL.

Request:

```json
{
  "url": "https://example.com/article",
  "useBrowserFallback": false
}
```

Response:

```json
{
  "requestId": "req_01HX0000000000000000000000",
  "url": "https://example.com/article",
  "finalUrl": "https://example.com/article",
  "retrievedAt": "2026-05-03T00:00:00.000Z",
  "contentType": "text/html; charset=utf-8",
  "contentLength": 54321,
  "title": "Article title",
  "description": "Article description",
  "canonicalUrl": "https://example.com/article"
}
```

This endpoint is optional for v1 but should be included if simple to implement.

---

## 15. OpenAPI specification

Create `openapi.yaml` with the following content and keep it in sync with implementation.

```yaml
openapi: 3.1.0
info:
  title: Web Fetch Extract Service
  version: 0.1.0
  description: Fetches public URLs and extracts readable text from HTML, PDFs, images, and rendered pages.
servers:
  - url: http://localhost:8080
security:
  - bearerAuth: []
paths:
  /v1/health:
    get:
      summary: Liveness check
      security: []
      responses:
        "200":
          description: Healthy
  /v1/ready:
    get:
      summary: Readiness check
      security: []
      responses:
        "200":
          description: Ready
        "503":
          description: Not ready
  /v1/extract:
    post:
      summary: Fetch and extract text from a URL
      operationId: extractUrl
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ExtractRequest"
      responses:
        "200":
          description: Extraction result
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ExtractResponse"
        "400":
          description: Invalid request
        "401":
          description: Unauthorized
        "403":
          description: URL blocked
        "408":
          description: Timeout
        "413":
          description: Response too large
        "415":
          description: Unsupported content type
        "422":
          description: Extraction failed
        "429":
          description: Rate limited
        "500":
          description: Internal error
  /v1/metadata:
    post:
      summary: Fetch URL metadata
      operationId: fetchMetadata
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [url]
              properties:
                url:
                  type: string
                  format: uri
                useBrowserFallback:
                  type: boolean
                  default: false
      responses:
        "200":
          description: Metadata result
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    ExtractRequest:
      type: object
      required:
        - url
      properties:
        url:
          type: string
          format: uri
        mode:
          type: string
          enum: [auto, html, pdf, text, image, browser]
          default: auto
        maxBytes:
          type: integer
          minimum: 1
        maxPages:
          type: integer
          minimum: 1
        maxTextChars:
          type: integer
          minimum: 1000
        chunkSizeChars:
          type: integer
          minimum: 500
        chunkOverlapChars:
          type: integer
          minimum: 0
        maxChunks:
          type: integer
          minimum: 1
        useBrowserFallback:
          type: boolean
        useOcrFallback:
          type: boolean
        allowedDomains:
          type: array
          items:
            type: string
        blockedDomains:
          type: array
          items:
            type: string
        includeRawText:
          type: boolean
          default: true
        includeChunks:
          type: boolean
          default: true
        metadataOnly:
          type: boolean
          default: false
    ExtractResponse:
      type: object
      required:
        - requestId
        - url
        - finalUrl
        - retrievedAt
        - extraction
        - warnings
      properties:
        requestId:
          type: string
        url:
          type: string
          format: uri
        finalUrl:
          type: string
          format: uri
        retrievedAt:
          type: string
          format: date-time
        contentType:
          type: string
        contentLength:
          type: integer
        title:
          type: string
          nullable: true
        description:
          type: string
          nullable: true
        language:
          type: string
          nullable: true
        extraction:
          type: object
          properties:
            method:
              type: string
            usedBrowser:
              type: boolean
            usedOcr:
              type: boolean
            pageCount:
              type: integer
              nullable: true
            pagesProcessed:
              type: integer
              nullable: true
            durationMs:
              type: integer
        limits:
          type: object
          properties:
            truncated:
              type: boolean
            maxBytes:
              type: integer
            maxTextChars:
              type: integer
            maxChunks:
              type: integer
        text:
          type: string
        chunks:
          type: array
          items:
            $ref: "#/components/schemas/Chunk"
        warnings:
          type: array
          items:
            type: string
    Chunk:
      type: object
      required:
        - index
        - text
        - charStart
        - charEnd
      properties:
        index:
          type: integer
        text:
          type: string
        charStart:
          type: integer
        charEnd:
          type: integer
        pageStart:
          type: integer
          nullable: true
        pageEnd:
          type: integer
          nullable: true
```

---

## 16. AI tool schema for Claude/Vertex orchestration

The service itself is provider-neutral. The calling app can expose it to Claude as a custom client-side tool.

Example tool definition:

```json
{
  "name": "fetch_url",
  "description": "Fetch and extract readable text from a public URL or PDF. Use only for URLs explicitly provided by the user or discovered from approved search results.",
  "input_schema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The public HTTPS URL to fetch."
      },
      "reason": {
        "type": "string",
        "description": "Brief reason this URL needs to be fetched."
      },
      "maxPages": {
        "type": "integer",
        "description": "Maximum PDF pages to process."
      },
      "useBrowserFallback": {
        "type": "boolean",
        "description": "Whether rendered browser extraction is allowed."
      },
      "useOcrFallback": {
        "type": "boolean",
        "description": "Whether OCR fallback is allowed."
      }
    },
    "required": ["url"]
  }
}
```

Tool execution mapping:

```text
model tool call fetch_url
        |
        v
orchestrator validates tool input
        |
        v
POST /v1/extract to this service
        |
        v
orchestrator returns extracted chunks as tool_result
```

The orchestrator, not the model, must enforce:

- allowed URL sources
- allowed domains
- max pages
- max bytes
- max calls per user request

---

## 17. Anthropic Web Fetch reference mapping

Anthropic's Web Fetch concept includes:

- fetching explicitly provided URLs
- fetching PDFs
- domain filtering
- maximum usage limits
- content limits
- optional citations
- exfiltration risk warnings
- no support for dynamically rendered JavaScript pages in the managed fetch path

This service should adapt those concepts as follows:

| Anthropic-style concept | This service |
|---|---|
| `web_fetch` | `POST /v1/extract` |
| `allowed_domains` | global `ALLOWED_DOMAINS` + request `allowedDomains` |
| `blocked_domains` | global `BLOCKED_DOMAINS` + request `blockedDomains` |
| `max_uses` | enforced by caller/orchestrator, not this stateless service |
| `max_content_tokens` | `maxTextChars`, `maxChunks`, chunking |
| PDF extraction | PDF.js text extraction + OCR fallback |
| citations | return URL, final URL, retrieved timestamp, page numbers, chunk offsets |
| dynamic filtering | caller/orchestrator can select returned chunks |
| JS-rendered sites unsupported | supported only via explicit Puppeteer fallback |

The implementation must not claim compatibility with Anthropic's server tool API. This is an independent service.

---

## 18. Logging and observability

Use structured JSON logs.

Every request must log:

- request ID
- route
- method
- normalized host
- extraction method
- duration
- success/failure
- error code if failed

Do not log:

- full extracted text
- API keys
- arbitrary headers
- cookies
- Authorization values

Add `x-request-id` support:

- use incoming `x-request-id` if present and safe
- otherwise generate one

---

## 19. Testing requirements

Use a red/green TDD loop where practical: add or update the failing behavior test for the slice, implement the smallest passing change, then refactor with checks green.

Minimum tests:

### URL policy tests

- rejects `file://`
- rejects `http://` when `ALLOW_HTTP=false`
- rejects localhost
- rejects `127.0.0.1`
- rejects `169.254.169.254`
- rejects RFC1918 private IPs
- rejects redirect to private IP
- accepts normal HTTPS public domain
- applies global blocklist
- applies request blocklist
- request allowlist cannot override global blocklist

### Extraction tests

- extracts title and text from HTML fixture
- removes scripts/styles
- chunks long text
- handles empty HTML gracefully
- handles text/plain
- handles unsupported content type

### API tests

- health returns 200
- ready returns 200
- missing auth returns 401 in production-like config
- invalid URL returns 400
- blocked URL returns 403
- mocked successful extraction returns expected response shape

### CI tests

- `npm run typecheck`
- `npm run lint`
- `npm test`
- Docker build succeeds on amd64
- Docker build succeeds on arm64

---

## 20. Package scripts

Create `package.json` with scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "docker:build": "docker build -t web-fetch-extract:local ."
  }
}
```

---

## 21. Dockerfile requirements

Use a multi-stage Dockerfile.

Requirements:

- install dependencies with `npm ci`
- build TypeScript
- prune dev dependencies
- run as non-root user
- expose port `8080`
- include Chromium dependencies required by Puppeteer
- set `NODE_ENV=production`

Example skeleton:

```Dockerfile
FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080

# Chromium dependencies for Puppeteer/Chrome.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN useradd --system --uid 10001 appuser
USER appuser

EXPOSE 8080
CMD ["node", "dist/server.js"]
```

If Puppeteer browser installation requires adjustment, the agent may use the official Puppeteer image or explicitly install a compatible Chromium package. The final image must still run as non-root.

---

## 22. GitHub Actions: CI

Create `.github/workflows/ci.yml`.

Required behavior:

- trigger on pull requests
- trigger on pushes to `main`
- run typecheck, lint, and tests
- use Node.js
- cache npm dependencies

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  test:
    name: Typecheck, lint, and test
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test
```

---

## 23. GitHub Actions: native Docker builds for Linux amd64 and arm64

Create `.github/workflows/docker-native.yml`.

Required behavior:

- trigger on `main`
- trigger on release tags
- build `linux/amd64` on native `ubuntu-24.04`
- build `linux/arm64` on native `ubuntu-24.04-arm`
- push per-architecture images to GHCR
- create and push a multi-architecture manifest
- tag `main` builds as `main`
- tag release builds using the Git tag
- also tag release builds as `latest`

Release tag patterns:

- `v*`
- `release-*`
- `release/*`

```yaml
name: Docker Native Multi-Arch

on:
  push:
    branches:
      - main
    tags:
      - "v*"
      - "release-*"
      - "release/*"

permissions:
  contents: read
  packages: write

env:
  IMAGE_NAME: ghcr.io/${{ github.repository }}

jobs:
  build:
    name: Build ${{ matrix.arch }} natively
    strategy:
      fail-fast: false
      matrix:
        include:
          - arch: amd64
            platform: linux/amd64
            runner: ubuntu-24.04
            suffix: amd64
          - arch: arm64
            platform: linux/arm64
            runner: ubuntu-24.04-arm
            suffix: arm64
    runs-on: ${{ matrix.runner }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set lowercase image name
        id: image
        shell: bash
        run: |
          echo "name=$(echo '${{ env.IMAGE_NAME }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"

      - name: Determine tags
        id: meta
        shell: bash
        run: |
          if [[ "${GITHUB_REF_TYPE}" == "tag" ]]; then
            VERSION="${GITHUB_REF_NAME}"
          else
            VERSION="main"
          fi

          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          echo "arch_tag=${{ steps.image.outputs.name }}:${VERSION}-${{ matrix.suffix }}" >> "$GITHUB_OUTPUT"

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push native image
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: ${{ matrix.platform }}
          push: true
          tags: ${{ steps.meta.outputs.arch_tag }}
          cache-from: type=gha,scope=${{ matrix.suffix }}
          cache-to: type=gha,scope=${{ matrix.suffix }},mode=max

  manifest:
    name: Create multi-arch manifest
    needs: build
    runs-on: ubuntu-24.04

    steps:
      - name: Set lowercase image name
        id: image
        shell: bash
        run: |
          echo "name=$(echo '${{ env.IMAGE_NAME }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"

      - name: Determine version tags
        id: meta
        shell: bash
        run: |
          if [[ "${GITHUB_REF_TYPE}" == "tag" ]]; then
            VERSION="${GITHUB_REF_NAME}"
            echo "is_release=true" >> "$GITHUB_OUTPUT"
          else
            VERSION="main"
            echo "is_release=false" >> "$GITHUB_OUTPUT"
          fi

          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          echo "image=${{ steps.image.outputs.name }}" >> "$GITHUB_OUTPUT"

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Create version manifest
        shell: bash
        run: |
          docker buildx imagetools create \
            -t "${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.version }}" \
            "${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.version }}-amd64" \
            "${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.version }}-arm64"

      - name: Create latest manifest for release tags
        if: steps.meta.outputs.is_release == 'true'
        shell: bash
        run: |
          docker buildx imagetools create \
            -t "${{ steps.meta.outputs.image }}:latest" \
            "${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.version }}-amd64" \
            "${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.version }}-arm64"
```

Notes:

- `ubuntu-24.04-arm` is the required native ARM64 Linux runner label.
- `ubuntu-24.04` is the native AMD64 Linux runner label.
- This avoids QEMU emulation for the actual architecture builds.
- The manifest job combines per-architecture images into one multi-arch tag.

---

## 24. GitHub Actions: GitHub Release

Create `.github/workflows/release.yml`.

Required behavior:

- trigger on release tags
- create a GitHub Release
- link to the GHCR image
- depend conceptually on Docker workflow having published the image

```yaml
name: Release

on:
  push:
    tags:
      - "v*"
      - "release-*"
      - "release/*"

permissions:
  contents: write
  packages: read

jobs:
  release:
    name: Create GitHub Release
    runs-on: ubuntu-24.04

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set lowercase image name
        id: image
        shell: bash
        run: |
          echo "name=$(echo 'ghcr.io/${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"

      - name: Create release notes
        id: notes
        shell: bash
        run: |
          cat > RELEASE_NOTES.md <<EOF
          ## Container image

          \`${{ steps.image.outputs.name }}:${{ github.ref_name }}\`

          Multi-architecture image:

          - linux/amd64
          - linux/arm64

          Also tagged as \`latest\`.
          EOF

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: RELEASE_NOTES.md
```

---

## 25. README requirements

Create a concise `README.md` with:

- what the service does
- local development
- environment variables
- API examples
- Docker run example
- Cloud Run deployment example
- AI tool integration example
- security notes
- link to `SPEC.md`
- link to `openapi.yaml`

Minimum curl example:

```bash
curl -sS http://localhost:8080/v1/extract \
  -H "Authorization: Bearer change-me-local-dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "includeRawText": true,
    "includeChunks": true
  }'
```

Docker example:

```bash
docker build -t web-fetch-extract:local .
docker run --rm -p 8080:8080 \
  -e API_KEYS=change-me-local-dev-key \
  web-fetch-extract:local
```

---

## 26. Minimal implementation acceptance criteria

The repository is considered ready when all of the following are true:

1. `npm ci` succeeds.
2. `npm run typecheck` succeeds.
3. `npm run lint` succeeds.
4. `npm test` succeeds.
5. `docker build .` succeeds on Linux AMD64.
6. `docker build .` succeeds on Linux ARM64.
7. `GET /v1/health` returns 200.
8. `GET /v1/ready` returns 200.
9. `POST /v1/extract` works for a simple HTTPS HTML page.
10. `POST /v1/extract` works for a text-layer PDF.
11. Private IP and metadata-server URLs are blocked.
12. GitHub Actions CI runs on PR and `main`.
13. GitHub Actions Docker workflow builds native AMD64 and ARM64 images.
14. Release tags publish versioned multi-arch images.
15. Release tags also publish `latest`.
16. `openapi.yaml` accurately describes the API.

---

## 27. Suggested implementation order for the AI agent

The AI agent should implement in this order:

Prefer red/green TDD within each step where practical.

1. Create Node/TypeScript project files.
2. Add Fastify app with health and ready endpoints.
3. Add config parsing and validation.
4. Add API key authentication.
5. Add URL policy and SSRF protection.
6. Add plain HTTP fetcher.
7. Add HTML extraction.
8. Add chunking.
9. Add `/v1/extract`.
10. Add PDF text extraction.
11. Add OCR fallback.
12. Add browser fallback.
13. Add tests.
14. Add Dockerfile.
15. Add OpenAPI spec.
16. Add GitHub Actions workflows.
17. Add README and SECURITY docs.
18. Run local checks and fix failures.
19. Ensure repo is ready for first GitHub push.

---

## 28. Implementation details and code-level guidance

### 28.1 Fastify app

`src/app.ts` should export a function:

```ts
export async function buildApp() {
  const app = Fastify({ logger });
  await app.register(helmet);
  await app.register(cors, { origin: false });
  await app.register(rateLimit, { max: 60, timeWindow: "1 minute" });

  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(extractRoutes, { prefix: "/v1" });

  return app;
}
```

`src/server.ts` should only boot the app.

### 28.2 Error model

All thrown domain errors should map to stable API errors.

Use a custom class:

```ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}
```

### 28.3 Request IDs

Add a request ID to every response.

Header:

```http
x-request-id: req_...
```

Response body includes the same `requestId`.

### 28.4 Type boundaries

Do not pass raw unvalidated request bodies into services. Validate with Zod at route boundary.

### 28.5 Extraction methods

Use stable method strings:

```text
html-readability
html-cheerio
pdfjs
ocr
browser
text
```

---

## 29. Cloud Run deployment guidance

Example deployment:

```bash
gcloud run deploy web-fetch-extract \
  --image ghcr.io/OWNER/REPO:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated=false \
  --set-env-vars NODE_ENV=production,LOG_LEVEL=info,ENABLE_BROWSER_FALLBACK=true,ENABLE_OCR=true \
  --set-secrets API_KEYS=web-fetch-api-keys:latest \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60 \
  --concurrency 10
```

For heavy OCR/browser usage, consider:

```text
memory: 4Gi
cpu: 4
concurrency: 2-5
```

---

## 30. Future enhancements

Do not implement these in v1 unless requested:

- persistent cache
- Redis-based rate limiting
- signed URL allowlist
- asynchronous extraction jobs
- malware scanning
- screenshot endpoint
- structured table extraction
- sitemap crawling
- search integration
- vector database ingestion
- per-tenant quotas
- admin dashboard

---

## 31. Final repo push checklist

Before pushing to GitHub:

```bash
npm ci
npm run typecheck
npm run lint
npm test
docker build -t web-fetch-extract:local .
docker run --rm -p 8080:8080 -e API_KEYS=dev-key web-fetch-extract:local
curl -sS http://localhost:8080/v1/health
```

Then:

```bash
git init
git add .
git commit -m "Initial web fetch extract service"
git branch -M main
git remote add origin git@github.com:OWNER/REPO.git
git push -u origin main
```

To publish a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Expected result:

- CI passes.
- Native AMD64 image is built on `ubuntu-24.04`.
- Native ARM64 image is built on `ubuntu-24.04-arm`.
- GHCR receives:
  - `ghcr.io/OWNER/REPO:main`
  - `ghcr.io/OWNER/REPO:v0.1.0`
  - `ghcr.io/OWNER/REPO:latest`
  - architecture-suffixed implementation tags.

---

## 32. References for implementers

These references are informational and must not be treated as compatibility requirements:

- Anthropic Web Fetch tool documentation: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool
- GitHub Actions hosted runner documentation: https://docs.github.com/actions/using-github-hosted-runners/about-github-hosted-runners
- GitHub Actions ARM64 runner changelog: https://github.blog/changelog/
- Docker Build GitHub Actions documentation: https://docs.docker.com/build/ci/github-actions/multi-platform/
- Puppeteer documentation: https://pptr.dev/
- PDF.js documentation: https://mozilla.github.io/pdf.js/
- Tesseract.js repository: https://github.com/naptha/tesseract.js/
