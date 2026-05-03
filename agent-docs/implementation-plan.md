# Web Fetch Extract Implementation Plan

Status: Drafted from `agent-bootstrap-docs/web-fetch-extract-service-spec.md`  
Last updated: 2026-05-03

## Goal

Build a provider-neutral, Dockerized HTTP service that accepts public URLs, enforces strict fetch policy, extracts readable text from HTML, plain text, PDFs, images, and rendered pages, and returns bounded raw text plus citation-friendly chunks.

The implementation is complete when the service meets the acceptance criteria in the bootstrap spec: local Node checks pass, Docker builds for Linux AMD64 and ARM64, health/readiness endpoints work, simple HTML and text-layer PDF extraction work, private network targets are blocked, and GitHub Actions publish tested multi-arch images.

## Product Shape

The first useful release is not a generic proxy. It is a managed extraction API with explicit authentication, URL policy, resource limits, structured errors, observable request logs, and predictable output for AI orchestration.

Primary endpoints:

- `GET /v1/health`
- `GET /v1/ready`
- `POST /v1/extract`
- `POST /v1/metadata` if it remains simple after `/v1/extract` is in place

Primary caller:

- An AI orchestration layer or application that has already selected an explicit public URL and wants bounded readable content for downstream model use.

## Delivery Strategy

Work in vertical slices. Each slice should leave the service more usable end to end rather than only adding a technical layer. Tests should be added with each slice at the point where the behavior becomes observable.

## Milestones

### M0: Project Skeleton and Booting Service

Outcome: A TypeScript/Fastify service boots locally and exposes unauthenticated liveness/readiness checks.

Scope:

- Node 22 TypeScript project files
- Fastify app/server split
- baseline config loader
- logger setup
- health and ready routes
- Vitest, ESLint, TypeScript configuration
- minimal CI-ready scripts

Acceptance checks:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `GET /v1/health` returns the specified shape
- `GET /v1/ready` returns the specified shape

### M1: Authenticated Safe Fetch Boundary

Outcome: A caller can request extraction only after authentication, and unsafe URL targets are blocked before any fetch.

Scope:

- API key authentication with production fail-fast behavior
- request ID handling
- URL parsing and normalization
- scheme policy
- domain allow/block policy
- DNS resolution before fetch
- private, link-local, multicast, localhost, and metadata IP blocking
- redirect target validation and re-resolution
- structured API errors

Acceptance checks:

- missing auth returns `401` in production-like config
- malformed URL returns `400`
- blocked URL returns `403`
- `file://`, localhost, `127.0.0.1`, RFC1918 ranges, and `169.254.169.254` are rejected
- request allowlist cannot override global blocklist

### M2: HTML and Plain Text Extraction API

Outcome: `POST /v1/extract` works for a normal HTTPS HTML or plain text resource with bounded output.

Scope:

- request/response Zod schemas
- plain HTTP fetcher using controlled outbound headers
- content-type detection
- HTML extraction with Readability, Cheerio cleanup, and visible text fallback
- direct `text/plain` extraction
- chunking with offsets and limits
- truncation metadata and warnings

Acceptance checks:

- simple HTTPS HTML page extracts title and readable text
- scripts/styles/navigation-like noise are removed where feasible
- text/plain returns text directly
- unsupported content type returns `415`
- long text is chunked within configured limits

### M3: PDF Text Extraction

Outcome: `POST /v1/extract` works for PDFs with embedded text and returns page-aware metadata/chunks.

Scope:

- PDF extractor accepting a `Buffer`
- page count inspection
- max page enforcement
- page text extraction
- page-aware chunk metadata
- low/empty text-layer reporting

Acceptance checks:

- text-layer PDF returns extracted text
- processing stops at `maxPages`
- page metadata is represented in extraction details and chunks where available
- empty or low-confidence text layer produces a warning or fallback signal

### M4: OCR Fallback

Outcome: Scanned PDFs and direct image URLs can be extracted when OCR is explicitly enabled.

Scope:

- OCR service using Tesseract.js
- scanned PDF page render path
- direct image OCR path
- max OCR page enforcement
- OCR duration and partial extraction warnings

Acceptance checks:

- OCR is skipped when disabled
- OCR respects `MAX_OCR_PAGES`
- response metadata reports OCR usage, pages OCRed, and warnings

### M5: Browser Fallback

Outcome: JavaScript-rendered HTML can be extracted only through an explicit, constrained Puppeteer fallback.

Scope:

- Puppeteer fallback for HTML only
- global and per-request fallback gates
- strict browser timeout
- request interception and resource blocking
- URL policy enforcement during browser navigation
- cleanup in `finally`
- max concurrent browser jobs

Acceptance checks:

- browser fallback runs only when enabled and needed or requested by mode
- rendered title/text/final URL are returned
- disallowed navigations are blocked
- browser/page are closed on success and failure

### M6: Container, OpenAPI, and Release Pipeline

Outcome: The service is documented, containerized, and publishable through CI/CD.

Scope:

- multi-stage Dockerfile
- non-root runtime user
- Chromium runtime dependencies or official Puppeteer-compatible base
- `.dockerignore`
- `.env.example`
- `openapi.yaml`
- `README.md`
- `SECURITY.md`
- GitHub Actions CI
- native AMD64/ARM64 Docker workflow
- release workflow

Acceptance checks:

- Docker build succeeds on Linux AMD64
- Docker build succeeds on Linux ARM64
- CI runs typecheck, lint, and tests
- release tags publish versioned and `latest` multi-arch images
- OpenAPI stays aligned with implementation

## Cross-Cutting Requirements

Security:

- No arbitrary caller-provided outbound headers
- No cookies, authorization forwarding, or external client tracing header forwarding
- No unrestricted proxy behavior
- No private/internal network access unless deliberately enabled by future policy changes
- No privileged Cloud Run container

Reliability:

- All network, browser, PDF, and OCR work must have explicit timeouts or resource limits
- Extraction should return structured warnings for partial results
- Errors should use stable API error codes

Observability:

- Log request ID, route, method, normalized host, extraction method, duration, success/failure, and error code
- Do not log extracted text, API keys, cookies, authorization values, or arbitrary headers

Testing:

- Prefer a red/green TDD loop for each vertical slice: write or adjust the failing behavior test first, make it pass, then refactor with checks still green.
- Add unit tests for policy and chunking before relying on integration behavior
- Use fixtures for HTML/PDF extraction
- Mock upstream fetch behavior where deterministic tests are needed

## Implementation Order

1. Scaffold project and health/readiness service.
2. Add config validation and auth.
3. Add URL policy and SSRF protections.
4. Add controlled fetcher.
5. Add extraction request/response schemas.
6. Add HTML and plain text extraction.
7. Add chunking and truncation.
8. Wire `/v1/extract`.
9. Add PDF text extraction.
10. Add OCR fallback.
11. Add browser fallback.
12. Add Docker, OpenAPI, README, SECURITY, and workflows.
