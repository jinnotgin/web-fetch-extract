import type { FastifyPluginCallback } from "fastify";

import type { AppConfig } from "../config.js";

type HealthRoutesOptions = {
  config: AppConfig;
};

export const healthRoutes: FastifyPluginCallback<HealthRoutesOptions> = (
  fastify,
  options,
  done
) => {
  fastify.get("/health", () => ({
    ok: true,
    service: options.config.serviceName,
    version: options.config.version
  }));

  fastify.get("/ready", () => ({
    ready: true,
    checks: {
      config: true,
      extractors: true
    }
  }));

  done();
};
