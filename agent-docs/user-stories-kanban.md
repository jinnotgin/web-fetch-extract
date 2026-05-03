# User Stories Kanban

Status: Initial vertical-slice backlog  
Last updated: 2026-05-03

This kanban is organized by user-visible capability. Stories should not be split into horizontal implementation-only tasks such as "routes", "services", or "tests" unless they are checklist items inside a vertical slice.

Implementation note: use a red/green TDD loop for each story where practical, with behavior tests driving the slice before refactoring.

## Done

### Story K0: Plan the Implementation from the Bootstrap Spec

As a maintainer, I want a concrete plan, vertical-slice kanban, and progress log so the blank repo can be implemented without repeatedly re-reading the full bootstrap spec.

Acceptance criteria:

- implementation plan exists
- kanban uses vertical user-value slices
- progress log exists and captures kickoff state
- docs reference the bootstrap spec as the source

Checklist:

- [x] Read bootstrap spec
- [x] Create implementation plan
- [x] Create vertical-slice kanban
- [x] Create initial progress log

### Story K1: Service Boots and Reports Health

As an operator, I want the service to start consistently and expose health/readiness endpoints so I can run it locally and deploy it behind a platform health check.

Acceptance criteria:

- Node 22 TypeScript project is scaffolded
- Fastify app boots through `src/server.ts`
- `GET /v1/health` returns `{ "ok": true, "service": "web-fetch-extract", "version": "0.1.0" }`
- `GET /v1/ready` returns config/extractor readiness
- baseline tests cover health and readiness
- `npm run typecheck`, `npm run lint`, and `npm test` are available

Checklist:

- [x] Create package, TypeScript, ESLint, and Vitest files
- [x] Create app/server structure
- [x] Add logger
- [x] Add health route
- [x] Add ready route
- [x] Add tests

### Story K2: Unsafe or Unauthenticated Requests Are Rejected

As a platform owner, I want authentication and strict URL policy before extraction exists so the service cannot be used as an open proxy or SSRF primitive.

Acceptance criteria:

- production config fails fast when `API_KEYS` is empty
- bearer auth is supported
- development `x-api-key` auth is supported
- unsupported schemes are rejected
- HTTP is rejected unless `ALLOW_HTTP=true`
- localhost, private IPs, link-local, multicast, and metadata IPs are rejected
- global blocklist cannot be overridden by request allowlist
- redirects are policy-checked before following

Checklist:

- [x] Add validated config module
- [x] Add auth hook
- [x] Add URL normalization
- [x] Add domain matcher
- [x] Add DNS/IP classifier
- [x] Add redirect policy tests
- [x] Add structured error responses

### Story K3: Caller Extracts a Normal Web Page

As an API caller, I want to submit a public HTTPS article page and receive readable title, metadata, text, and chunks so I can pass bounded content to an AI model.

Acceptance criteria:

- `POST /v1/extract` validates request body
- fetcher uses only the service-approved outbound headers
- HTML extraction uses Readability first
- fallback visible text extraction removes obvious boilerplate elements
- response includes final URL, content type, extraction metadata, text, chunks, and warnings
- content length, text length, and chunk count limits are enforced

Checklist:

- [x] Add extract schemas
- [x] Add controlled fetcher
- [x] Add MIME detection
- [x] Add HTML extractor
- [x] Add chunker
- [x] Wire extract route
- [x] Test HTML fixture extraction

### Story K4: Caller Extracts Plain Text Safely

As an API caller, I want plain text URLs to return bounded text and chunks directly so simple documents do not go through unnecessary HTML or PDF processing.

Acceptance criteria:

- `text/plain` is detected
- plain text is returned without markup processing
- truncation and chunk limits match the same contract as HTML
- unsupported types produce `UNSUPPORTED_CONTENT_TYPE`

Checklist:

- [x] Add plain text branch in extraction service
- [x] Add unsupported content-type error path
- [x] Test plain text response
- [x] Test unsupported content type

### Story K5: Caller Extracts a Text-Layer PDF

As an API caller, I want a PDF with embedded text to return page-aware extracted content so citations can reference page ranges and chunks.

Acceptance criteria:

- PDF content type is detected
- PDF extractor processes up to `maxPages`
- page count and pages processed are returned
- chunks include page start/end when available
- low or empty text layer is reported for fallback handling

Checklist:

- [x] Select and configure PDF.js dependency
- [x] Add PDF extractor
- [x] Add page-aware chunk input model
- [x] Add PDF fixture
- [x] Test text-layer PDF extraction

### Story K6: Caller Extracts Scanned PDFs and Images with OCR

As an API caller, I want scanned PDFs and image documents to be OCRed only when enabled so expensive CPU work is explicit and bounded.

Acceptance criteria:

- OCR fallback honors global and request flags
- direct image URLs can be OCRed
- scanned PDF pages are OCRed up to `MAX_OCR_PAGES`
- response metadata includes `usedOcr`, pages OCRed, duration, and partial warnings

Checklist:

- [x] Add OCR extractor
- [x] Add scanned PDF render path
- [x] Add image content-type branch
- [x] Add OCR limits and warnings
- [x] Add OCR tests with small fixtures or mocks

### Story K7: Caller Extracts a Rendered Web Page with Browser Fallback

As an API caller, I want JavaScript-rendered pages to be extracted through a constrained browser fallback when explicitly allowed.

Acceptance criteria:

- browser fallback runs only for HTML/browser mode and only when enabled
- browser navigation enforces the same URL policy
- browser work has timeout and concurrency limits
- unnecessary resources are blocked
- browser/page close in `finally`
- response reports `method: "browser"` and `usedBrowser: true`

Checklist:

- [x] Add browser extractor
- [x] Add concurrency limiter
- [x] Add resource blocking
- [x] Add navigation URL policy guard
- [x] Add browser fallback tests or integration smoke test

### Story K8: Operator Runs the Service in Docker

As an operator, I want a production-style container image that runs as non-root and includes required browser dependencies so the service can deploy to Cloud Run or another OCI runtime.

Acceptance criteria:

- multi-stage Dockerfile builds TypeScript
- production image omits dev dependencies
- runtime user is non-root
- port `8080` is exposed
- Puppeteer/Chromium dependencies are present
- `.dockerignore` excludes local/dev artifacts

Checklist:

- [x] Add Dockerfile
- [x] Add `.dockerignore`
- [x] Verify local Docker build where available
- [x] Document Docker run command

### Story K9: Maintainer Gets CI, Native Multi-Arch Images, and Releases

As a maintainer, I want CI and release workflows so PRs are checked and release tags publish GHCR multi-arch images.

Acceptance criteria:

- CI runs on PRs and pushes to `main`
- CI runs typecheck, lint, and tests
- Docker workflow builds native AMD64 and ARM64 images
- Docker workflow publishes a multi-arch manifest
- release workflow creates GitHub Releases for release tags

Checklist:

- [x] Add `.github/workflows/ci.yml`
- [x] Add `.github/workflows/docker-native.yml`
- [x] Add `.github/workflows/release.yml`
- [x] Check workflow syntax

### Story K10: Integrator Understands the API and Safety Model

As an integrator, I want README, OpenAPI, and security documentation so I can call the service correctly and understand its limits.

Acceptance criteria:

- README explains purpose, local dev, Docker, Cloud Run, API examples, and AI tool integration
- `openapi.yaml` describes implemented endpoints and schemas
- `SECURITY.md` documents non-goals, SSRF controls, auth expectations, and disclosure path
- `.env.example` lists validated runtime options
- `SPEC.md` captures the final service contract or links back to the bootstrap-derived contract

Checklist:

- [x] Add `.env.example`
- [x] Add `openapi.yaml`
- [x] Add `README.md`
- [x] Add `SECURITY.md`
- [x] Add `SPEC.md`

## In Progress

No implementation story is in progress yet.

## Next

No implementation stories remain in the current kanban.
- [ ] Add `README.md`
- [ ] Add `SECURITY.md`
- [ ] Add `SPEC.md`

## Parking Lot

These are intentionally outside the first implementation pass unless the spec changes.

- Persistent content storage
- General web search
- Authenticated or paywalled fetching
- Arbitrary caller-supplied outbound headers
- Exposing browser automation controls to model output
- Citation post-processing beyond URL, timestamp, offsets, and page ranges
