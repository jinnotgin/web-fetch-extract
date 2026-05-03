# Progress Log

## 2026-05-03

### Session Goal

Start from `agent-bootstrap-docs/web-fetch-extract-service-spec.md` and create planning artifacts that can guide implementation of the blank repository.

### Completed

- Read the bootstrap service specification.
- Confirmed the repository is otherwise effectively blank, with only `LICENSE` and `agent-bootstrap-docs/web-fetch-extract-service-spec.md` present.
- Created `agent-docs/implementation-plan.md`.
- Created `agent-docs/user-stories-kanban.md`.
- Created `agent-docs/progress-log.md`.

### Key Decisions

- Plan work as vertical slices that each produce an observable service capability.
- Put security and SSRF controls before any real extraction path.
- Treat HTML/plain text extraction as the first usable `/v1/extract` release.
- Keep OCR and browser fallback as later bounded fallback slices because they are heavier operationally and riskier.

### Current Kanban State

- Done: planning from bootstrap spec.
- In progress: none.
- Next: service bootstrapping and health/readiness endpoints.
- Later: PDF, OCR, browser fallback, Docker, CI/CD, README/OpenAPI/security docs.

### Risks and Watch Items

- Puppeteer image strategy may need adjustment after dependency installation and Docker build testing.
- PDF.js package selection should be verified against Node 22 and ESM/CommonJS behavior before implementation locks in.
- SSRF protection must cover both initial fetch and every redirect target; this should be tested early.
- OCR tests should avoid slow or brittle fixtures where mocked boundaries can prove policy behavior.

### Next Action

Begin Story K1 from `agent-docs/user-stories-kanban.md`: scaffold the Node/TypeScript Fastify service and implement `/v1/health` plus `/v1/ready`.

### Implementation Update

- Completed Story K1.
- Added Node 22 TypeScript project scaffolding, Fastify app/server split, config loader, health/readiness routes, and baseline tests.
- Installed dependencies and generated `package-lock.json`.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Moved Story K2 into progress: unsafe or unauthenticated requests are rejected.

### Workflow Note

- Use red/green TDD for upcoming slices where practical: add or adjust the failing behavior test first, make the smallest implementation pass, then refactor while keeping checks green.

### Boundary Implementation Update

- Completed Story K2.
- Added API key authentication for `/v1/extract`, production config fail-fast when keys are empty, request ID aware error responses, URL normalization, domain allow/block checks, DNS-based private IP blocking, and redirect-target policy validation.
- Added tests for auth, invalid request shape, blocked extract URLs, production API key requirements, URL scheme policy, private and metadata IP blocking, global/request domain controls, and redirect-to-private-IP rejection.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

### Optional Auth Update

- Added Story K11 as an incremental behavior-change story after the original K2 security boundary.
- Changed `API_KEYS` semantics so empty or unset `API_KEYS` disables service-level authentication in all environments, including production.
- Retained `401 UNAUTHORIZED` behavior when one or more API keys are configured.
- Updated README, SECURITY, SPEC, kanban, implementation plan, and tests to make the deployment tradeoff explicit.

### HTML and Plain Text Extraction Update

- Completed Stories K3 and K4 using a red/green loop.
- Added failing tests first for chunking, HTML fixture extraction, API HTML extraction, API plain text extraction, and unsupported content types.
- Added controlled fetcher interface, MIME helpers, Readability/Cheerio HTML extraction, chunking, and extraction service wiring for `/v1/extract`.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

### PDF Text Extraction Update

- Completed Story K5.
- Added `pdfjs-dist` and a `pdfExtractor` service that accepts a `Buffer`, processes up to `maxPages`, extracts text per page, reports page count/pages processed, and warns when the text layer is empty or low confidence.
- Extended chunking with optional page ranges so PDF chunks can include `pageStart` and `pageEnd`.
- Added a small text-layer PDF fixture and API coverage for `application/pdf`, `maxPages`, PDF warnings, and page-aware chunks.
- Added `MAX_PDF_PAGES` runtime config with a default of `30`.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Added downloaded web fixtures for W3C/Orimi PDFs and W3C HTML pages, plus API tests that exercise them offline from disk.
- Added `agent-docs/pdf-sample-sources.md` and `agent-docs/html-sample-sources.md` to record fixture provenance.

### OCR Extraction Update

- Completed Story K6.
- Added `tesseract.js` for OCR and `@napi-rs/canvas` so PDF.js can render scanned PDF pages to images before OCR.
- Added `ocrExtractor` with direct image OCR and scanned-PDF page OCR paths.
- Added `ENABLE_OCR` and `MAX_OCR_PAGES` runtime config.
- Extended `/v1/extract` so `image/*` content types OCR when enabled, request-level `useOcrFallback=false` disables image OCR, and empty-text PDFs fall back to OCR when OCR is globally and per-request enabled.
- Extended extraction metadata with `usedOcr`, `pagesOcred`, and `ocrDurationMs`.
- Added mocked OCR API tests for direct image OCR, disabled OCR behavior, and scanned-PDF OCR respecting `MAX_OCR_PAGES`; this keeps the default test suite offline and fast.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

### Browser Fallback Update

- Completed Story K7.
- Added `puppeteer` with browser download skipped at install time; runtime Chromium/browser provisioning is left for Docker in Story K8.
- Added `browserExtractor` with Puppeteer launch, strict timeouts, resource blocking for font/image/media requests, navigation URL-policy checks, cleanup in `finally`, and a simple concurrency limiter.
- Added `ENABLE_BROWSER_FALLBACK`, `BROWSER_TIMEOUT_MS`, and `MAX_BROWSER_CONCURRENCY` runtime config.
- Extended HTML extraction so low-text HTML in `auto` mode can use browser fallback when globally and per-request enabled; forced `mode: "browser"` fails with `EXTRACTION_FAILED` if browser fallback is disabled.
- Added mocked browser fallback API tests for automatic fallback, request-level disabling, and global disabling.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

### Docker Runtime Update

- Completed Story K8.
- Added a multi-stage `Dockerfile` with build, production dependency, and runtime stages.
- Runtime image installs Debian `chromium`, `fonts-liberation`, `ca-certificates`, and `dumb-init`, sets `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`, exposes port `8080`, and runs as the non-root `node` user.
- Added `.dockerignore` to keep local dependencies, build output, tests, docs, and local environment files out of the image context.
- Added a minimal README Docker build/run/health section.
- Fixed the service start command from `dist/server.js` to `dist/src/server.js`, matching the current TypeScript output layout.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Verified `docker build -t web-fetch-extract:local .` succeeds locally.
- Smoke-ran the image with `API_KEYS=local-dev-key`; the container started and `GET /v1/health` returned the expected JSON from inside the container. Host `localhost:18080` did not connect in this local Docker/Colima environment despite the published port mapping, so external host-port verification remains environment-dependent.

### CI and Release Workflow Update

- Completed Story K9.
- Added `.github/workflows/ci.yml` for pull requests and pushes to `main`; it runs `npm ci`, typecheck, lint, tests, and build on Node 22.
- Added `.github/workflows/docker-native.yml` with native `linux/amd64` builds on `ubuntu-24.04` and native `linux/arm64` builds on `ubuntu-24.04-arm`, GHCR push on non-PR events, and multi-arch manifest creation for commit SHA, `latest` on `main`, and version tags.
- Added `.github/workflows/release.yml` to create GitHub Releases for `v*` tags using generated release notes.
- Checked workflow YAML syntax locally with Ruby YAML parsing.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.

### Integrator Documentation Update

- Completed Story K10.
- Added `.env.example` with implemented runtime configuration.
- Expanded `README.md` with local development, extraction example, Docker commands, configuration notes, and safety model summary.
- Added `openapi.yaml` for health, readiness, and extract endpoints.
- Added `SECURITY.md` covering non-goals, auth, fetch controls, sensitive data guidance, and reporting.
- Added `SPEC.md` summarizing the implemented service contract and linking it back to the bootstrap-derived source.
- Parsed OpenAPI/workflow YAML locally with Ruby YAML parsing.
- Verified `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
