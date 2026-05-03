import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import type { AppError } from "../src/errors.js";
import {
  validateRedirectTarget,
  validateUrlPolicy,
  type DnsLookup
} from "../src/services/urlPolicy.js";

const publicLookup: DnsLookup = () =>
  Promise.resolve([{ address: "93.184.216.34", family: 4 }]);
const privateLookup: DnsLookup = () =>
  Promise.resolve([{ address: "10.0.0.5", family: 4 }]);

describe("url policy", () => {
  it("rejects file URLs", async () => {
    await expectPolicyError("file:///etc/passwd", "INVALID_URL");
  });

  it("rejects HTTP URLs when ALLOW_HTTP is false", async () => {
    await expectPolicyError("http://example.com", "INVALID_URL");
  });

  it("accepts HTTP URLs when ALLOW_HTTP is true", async () => {
    const result = await validateUrlPolicy(
      { url: "http://example.com" },
      loadConfig({ NODE_ENV: "test", ALLOW_HTTP: "true" }),
      { lookup: publicLookup }
    );

    expect(result.hostname).toBe("example.com");
  });

  it("rejects localhost", async () => {
    await expectPolicyError("https://localhost", "URL_BLOCKED");
  });

  it("rejects 127.0.0.1", async () => {
    await expectPolicyError("https://127.0.0.1", "URL_BLOCKED");
  });

  it("rejects metadata server IPs", async () => {
    await expectPolicyError("https://169.254.169.254", "URL_BLOCKED");
  });

  it("rejects RFC1918 private IPs", async () => {
    await expectPolicyError("https://192.168.1.20", "URL_BLOCKED");
  });

  it("rejects hostnames that resolve to private IPs", async () => {
    const config = loadConfig({ NODE_ENV: "test" });

    await expect(
      validateUrlPolicy({ url: "https://example.com" }, config, {
        lookup: privateLookup
      })
    ).rejects.toMatchObject({
      code: "URL_BLOCKED"
    });
  });

  it("accepts normal HTTPS public domains", async () => {
    const result = await validateUrlPolicy(
      { url: "https://Example.COM/path" },
      loadConfig({ NODE_ENV: "test" }),
      { lookup: publicLookup }
    );

    expect(result).toMatchObject({
      hostname: "example.com",
      resolvedAddresses: ["93.184.216.34"]
    });
  });

  it("applies global blocklist", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      BLOCKED_DOMAINS: "blocked.example"
    });

    await expect(
      validateUrlPolicy({ url: "https://blocked.example" }, config, {
        lookup: publicLookup
      })
    ).rejects.toMatchObject({
      code: "URL_BLOCKED"
    });
  });

  it("applies request blocklist", async () => {
    await expect(
      validateUrlPolicy(
        {
          url: "https://blocked.example",
          blockedDomains: ["blocked.example"]
        },
        loadConfig({ NODE_ENV: "test" }),
        { lookup: publicLookup }
      )
    ).rejects.toMatchObject({
      code: "URL_BLOCKED"
    });
  });

  it("does not let a request allowlist override a global blocklist", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      BLOCKED_DOMAINS: "blocked.example"
    });

    await expect(
      validateUrlPolicy(
        {
          url: "https://blocked.example",
          allowedDomains: ["blocked.example"]
        },
        config,
        { lookup: publicLookup }
      )
    ).rejects.toMatchObject({
      code: "URL_BLOCKED"
    });
  });

  it("rejects redirects to private IPs", async () => {
    await expect(
      validateRedirectTarget(
        "https://example.com/start",
        "https://10.0.0.1/private",
        loadConfig({ NODE_ENV: "test" }),
        { lookup: publicLookup }
      )
    ).rejects.toMatchObject({
      code: "URL_BLOCKED"
    });
  });
});

async function expectPolicyError(url: string, code: AppError["code"]) {
  await expect(
    validateUrlPolicy({ url }, loadConfig({ NODE_ENV: "test" }), {
      lookup: publicLookup
    })
  ).rejects.toMatchObject({ code });
}
