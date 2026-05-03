import crypto from "node:crypto";

import Fastify from "fastify";

import { loadConfig, type AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { extractRoutes } from "./routes/extract.js";
import { healthRoutes } from "./routes/health.js";
import type { ExtractServiceOptions } from "./services/extractService.js";
import type { DnsLookup } from "./services/urlPolicy.js";

export type BuildAppOptions = {
  config?: AppConfig;
  logger?: boolean;
  services?: ExtractServiceOptions & {
    urlPolicyLookup?: DnsLookup;
  };
};

export function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      const value = Array.isArray(incoming) ? incoming[0] : incoming;
      return isSafeRequestId(value) ? value : crypto.randomUUID();
    },
    logger: options.logger ?? config.NODE_ENV !== "test"
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        requestId: request.id,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details })
        }
      });
      return;
    }

    request.log.error({ err: error }, "unhandled request error");
    void reply.status(500).send({
      requestId: request.id,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error."
      }
    });
  });

  app.register(healthRoutes, {
    prefix: "/v1",
    config
  });

  app.register(extractRoutes, {
    prefix: "/v1",
    config,
    services: options.services
  });

  return app;
}

function isSafeRequestId(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}
