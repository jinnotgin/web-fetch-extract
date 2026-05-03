# PDF Sample Sources

Status: Downloaded fixture reference list  
Last updated: 2026-05-03

The committed `test/fixtures/sample.pdf` is intentionally generated and tiny so edge-case unit tests remain deterministic and easy to inspect.

Downloaded PDF fixtures:

| Source | URL | Notes |
|---|---|---|
| `test/fixtures/web-pdf/w3c-dummy.pdf` | `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf` | Small public W3C test PDF. |
| `test/fixtures/web-pdf/orimi-pdf-test.pdf` | `https://orimi.com/pdf-test.pdf` | Common simple PDF test file. |

Guidance:

- Use the generated fixture for precise page-limit and page-aware chunk expectations.
- Use downloaded fixtures to catch real-world PDF parser behavior regressions.
- Do not add large PDFs to the normal test suite without checking repository size and test runtime.
