import type { FastifyRequest } from "fastify";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";

export function authenticateApiKey(
  request: FastifyRequest,
  config: Pick<AppConfig, "apiKeys">
) {
  if (config.apiKeys.length === 0) {
    return;
  }

  const providedKey = readBearerToken(request) ?? readDevelopmentApiKey(request);

  if (providedKey === undefined || !config.apiKeys.includes(providedKey)) {
    throw new AppError(401, "UNAUTHORIZED", "Missing or invalid API key.");
  }
}

function readBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;

  if (typeof header !== "string") {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim();
}

function readDevelopmentApiKey(request: FastifyRequest): string | undefined {
  const header = request.headers["x-api-key"];

  if (Array.isArray(header)) {
    return header[0];
  }

  return header;
}
