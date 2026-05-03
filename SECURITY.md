# Security Policy

## Scope

This service fetches public URLs and extracts readable text. It is not a proxy, browser automation API, paywall bypass tool, private-network fetcher, or general web search engine.

## Fetch Controls

- Only `https:` is allowed by default.
- `http:` requires `ALLOW_HTTP=true`.
- Localhost, private IP ranges, link-local ranges, multicast ranges, and metadata addresses are blocked unless private IP access is explicitly enabled.
- Hostnames are DNS-resolved before fetch.
- Redirect targets are policy-checked before following.
- Global blocked domains cannot be overridden by request allowlists.
- Caller-provided outbound headers are not accepted or forwarded.

## Authentication

Production requires `API_KEYS` to be non-empty at boot. Callers authenticate with:

```http
Authorization: Bearer <api-key>
```

Development also accepts:

```http
x-api-key: <api-key>
```

## Sensitive Data

Do not send secrets, cookies, private URLs, or authorization-bearing URLs to this service. Extracted content is returned to the caller and is not intentionally persisted by the service.

## Reporting

Report security issues privately through the repository owner or hosting organization security contact. Do not open public issues containing exploit details or private target URLs.
