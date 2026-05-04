import { describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

describe("health routes", () => {
  it("returns the liveness response", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: "web-fetch-extract",
      version: packageJson.version
    });
  });

  it("returns the readiness response", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ready: true,
      checks: {
        config: true,
        extractors: true
      }
    });
  });

  it("allows all CORS origins by default", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test" }),
      logger: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: {
        origin: "http://localhost:5173"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("echoes a restricted CORS origin when allowed", async () => {
    const app = buildApp({
      config: loadConfig({
        NODE_ENV: "test",
        CORS_ORIGINS: "http://localhost:5173,https://app.example.com"
      }),
      logger: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: {
        origin: "https://app.example.com"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("https://app.example.com");
    expect(response.headers.vary).toBe("Origin");
  });

  it("omits allow-origin for a restricted CORS origin when denied", async () => {
    const app = buildApp({
      config: loadConfig({
        NODE_ENV: "test",
        CORS_ORIGINS: "https://app.example.com"
      }),
      logger: false
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: {
        origin: "http://localhost:5173"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers.vary).toBe("Origin");
  });

  it("handles CORS preflight requests", async () => {
    const app = buildApp({
      config: loadConfig({
        NODE_ENV: "test",
        CORS_ORIGINS: "http://localhost:5173"
      }),
      logger: false
    });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/extract",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-methods"]).toBe("GET,POST,OPTIONS");
    expect(response.headers["access-control-allow-headers"]).toContain("content-type");
  });
});
