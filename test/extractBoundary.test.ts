import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

describe("extract boundary", () => {
  it("requires authentication when API keys are configured", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test", API_KEYS: "test-key" }),
      logger: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      payload: {
        url: "https://example.com"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: "UNAUTHORIZED"
      }
    });
  });

  it("returns invalid request for a missing URL", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test", API_KEYS: "test-key" }),
      logger: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        authorization: "Bearer test-key"
      },
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST"
      }
    });
  });

  it("blocks unsafe URLs before extraction", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "test", API_KEYS: "test-key" }),
      logger: false
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      headers: {
        "x-api-key": "test-key"
      },
      payload: {
        url: "https://127.0.0.1"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: "URL_BLOCKED"
      }
    });
  });

  it("allows unauthenticated production mode when API keys are empty", async () => {
    const app = buildApp({
      config: loadConfig({ NODE_ENV: "production", API_KEYS: "" }),
      logger: false,
      services: {
        urlPolicyLookup: () =>
          Promise.resolve([{ address: "93.184.216.34", family: 4 }]),
        fetchUrl: () =>
          Promise.resolve({
            finalUrl: "https://example.com/readme.txt",
            contentType: "text/plain; charset=utf-8",
            contentLength: 25,
            body: Buffer.from("Plain text document body.")
          })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/extract",
      payload: {
        url: "https://example.com/readme.txt"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      text: "Plain text document body."
    });
  });
});
