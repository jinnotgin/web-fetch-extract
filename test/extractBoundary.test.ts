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

  it("fails production config when API keys are empty", () => {
    expect(() => loadConfig({ NODE_ENV: "production", API_KEYS: "" })).toThrow(
      "API_KEYS must not be empty in production"
    );
  });
});
