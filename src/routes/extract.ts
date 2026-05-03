import type { FastifyPluginCallback } from "fastify";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";
import { authenticateApiKey } from "../services/auth.js";
import { extractUrl, type ExtractServiceOptions } from "../services/extractService.js";
import { validateUrlPolicy } from "../services/urlPolicy.js";
import type { DnsLookup } from "../services/urlPolicy.js";

const extractBoundarySchema = z.object({
  url: z.string(),
  mode: z
    .enum(["auto", "html", "pdf", "text", "image", "browser"])
    .default("auto"),
  maxBytes: z.number().int().positive().optional(),
  maxPages: z.number().int().positive().optional(),
  maxTextChars: z.number().int().min(1000).default(500000),
  chunkSizeChars: z.number().int().min(500).default(6000),
  chunkOverlapChars: z.number().int().min(0).default(500),
  maxChunks: z.number().int().positive().default(80),
  useBrowserFallback: z.boolean().default(true),
  useOcrFallback: z.boolean().default(true),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
  includeRawText: z.boolean().default(true),
  includeChunks: z.boolean().default(true),
  metadataOnly: z.boolean().default(false)
});

type ExtractRoutesOptions = {
  config: AppConfig;
  services?: ExtractServiceOptions & {
    urlPolicyLookup?: DnsLookup;
  };
};

export const extractRoutes: FastifyPluginCallback<ExtractRoutesOptions> = (
  fastify,
  options,
  done
) => {
  fastify.post("/extract", async (request) => {
    authenticateApiKey(request, options.config);

    const parsed = extractBoundarySchema.safeParse(request.body);

    if (!parsed.success) {
      throw new AppError(400, "INVALID_REQUEST", "Request schema failed validation.", {
        issues: parsed.error.issues
      });
    }

    const policy = await validateUrlPolicy(parsed.data, options.config, {
      lookup: options.services?.urlPolicyLookup
    });

    return extractUrl(
      {
        requestId: request.id,
        normalizedUrl: policy.normalizedUrl,
        request: parsed.data,
        config: options.config
      },
      {
        fetchUrl: options.services?.fetchUrl,
        ocrExtractor: options.services?.ocrExtractor,
        browserExtractor: options.services?.browserExtractor,
        urlPolicyLookup: options.services?.urlPolicyLookup
      }
    );
  });

  done();
};
