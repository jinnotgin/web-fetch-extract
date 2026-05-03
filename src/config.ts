import "dotenv/config";

import { z } from "zod";

export const SERVICE_NAME = "web-fetch-extract";
export const SERVICE_VERSION = "0.1.0";

const booleanEnv = z
  .preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    if (typeof value === "string") {
      return value.toLowerCase();
    }

    return value;
  }, z.enum(["true", "false"]))
  .transform((value) => value === "true")
  .default(false);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  API_KEYS: z.string().default(""),
  ALLOW_HTTP: booleanEnv,
  ALLOW_PRIVATE_IPS: booleanEnv,
  MAX_REDIRECTS: z.coerce.number().int().min(0).default(5),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  MAX_PDF_PAGES: z.coerce.number().int().positive().default(30),
  ALLOWED_DOMAINS: z.string().default(""),
  BLOCKED_DOMAINS: z.string().default("localhost,127.0.0.1,169.254.169.254")
});

type ParsedEnv = z.infer<typeof envSchema>;

export type AppConfig = Omit<
  ParsedEnv,
  "API_KEYS" | "ALLOWED_DOMAINS" | "BLOCKED_DOMAINS"
> & {
  serviceName: typeof SERVICE_NAME;
  version: typeof SERVICE_VERSION;
  apiKeys: string[];
  allowedDomains: string[];
  blockedDomains: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const apiKeys = parseCsv(parsed.API_KEYS);

  if (parsed.NODE_ENV === "production" && apiKeys.length === 0) {
    throw new Error("API_KEYS must not be empty in production");
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    LOG_LEVEL: parsed.LOG_LEVEL,
    ALLOW_HTTP: parsed.ALLOW_HTTP,
    ALLOW_PRIVATE_IPS: parsed.ALLOW_PRIVATE_IPS,
    MAX_REDIRECTS: parsed.MAX_REDIRECTS,
    REQUEST_TIMEOUT_MS: parsed.REQUEST_TIMEOUT_MS,
    MAX_PDF_PAGES: parsed.MAX_PDF_PAGES,
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    apiKeys,
    allowedDomains: parseCsv(parsed.ALLOWED_DOMAINS),
    blockedDomains: parseCsv(parsed.BLOCKED_DOMAINS)
  };
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
