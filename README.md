# Web Fetch Extract

Provider-neutral HTTP service for fetching public URLs and extracting bounded readable text from HTML, plain text, PDFs, images, and rendered pages.

## Local Development

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Start locally with authentication:

```bash
API_KEYS=local-dev-key npm run dev
```

If `API_KEYS` is empty or unset, `/v1/extract` does not require authentication. That can be useful behind a trusted gateway, but do not expose an unauthenticated instance directly to the public internet.

Health:

```bash
curl http://localhost:8080/v1/health
```

## Extract

```bash
curl -sS http://localhost:8080/v1/extract \
  -H 'Authorization: Bearer local-dev-key' \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://www.w3.org/TR/WCAG21/",
    "includeRawText": true,
    "includeChunks": true
  }'
```

Response content is bounded by `maxTextChars`, `chunkSizeChars`, `chunkOverlapChars`, and `maxChunks`.

## Safety Model

The service is not an open proxy. It can enforce API key auth, and always enforces URL scheme policy, DNS/IP blocking, redirect target checks, domain allow/block rules, request timeouts, PDF/OCR/browser limits, and controlled outbound headers.

## Docker

Build:

```bash
docker build -t web-fetch-extract:local .
```

Run:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEYS=local-dev-key \
  web-fetch-extract:local
```

Health check:

```bash
curl http://localhost:8080/v1/health
```

## Configuration

Copy `.env.example` and set `API_KEYS` when the service should enforce its own API key auth. Leave `API_KEYS` empty only when another trusted layer handles access control.

Key controls:

- `ALLOW_HTTP`
- `ALLOW_PRIVATE_IPS`
- `ALLOWED_DOMAINS`
- `BLOCKED_DOMAINS`
- `MAX_PDF_PAGES`
- `MAX_OCR_PAGES`
- `ENABLE_OCR`
- `ENABLE_BROWSER_FALLBACK`
- `MAX_BROWSER_CONCURRENCY`

## API Docs

See `openapi.yaml` for the OpenAPI contract and `SPEC.md` for the implemented service contract.
