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
