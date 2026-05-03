import { describe, expect, it } from "vitest";

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
      version: "0.1.0"
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
});
