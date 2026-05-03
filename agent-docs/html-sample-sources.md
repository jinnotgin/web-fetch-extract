# HTML Sample Sources

Status: Downloaded fixture reference list  
Last updated: 2026-05-03

Downloaded HTML fixtures:

| Source | URL | Notes |
|---|---|---|
| `test/fixtures/web-html/w3c-wcag21.html` | `https://www.w3.org/TR/WCAG21/` | Larger specification-style HTML page. Useful for Readability and chunking behavior. |
| `test/fixtures/web-html/w3c-berners-lee.html` | `https://www.w3.org/People/Berners-Lee/` | Profile-style HTML page with simpler semantic content. |

Guidance:

- Keep `test/fixtures/sample.html` for minimal, controlled extraction expectations.
- Use downloaded fixtures to catch regressions on real public HTML structure.
- Tests should read these files from disk and must not fetch the network during `npm test`.
