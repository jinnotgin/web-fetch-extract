import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import { domainToASCII } from "node:url";

import type { AppConfig } from "../config.js";
import { AppError } from "../errors.js";

export type UrlPolicyInput = {
  url: string;
  allowedDomains?: string[];
  blockedDomains?: string[];
};

export type UrlPolicyResult = {
  normalizedUrl: string;
  hostname: string;
  resolvedAddresses: string[];
};

export type DnsLookup = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

export type UrlPolicyOptions = {
  lookup?: DnsLookup;
};

const defaultLookup: DnsLookup = async (hostname) =>
  dnsLookup(hostname, {
    all: true,
    verbatim: true
  });

export async function validateUrlPolicy(
  input: UrlPolicyInput,
  config: AppConfig,
  options: UrlPolicyOptions = {}
): Promise<UrlPolicyResult> {
  const url = parseUrl(input.url);

  validateScheme(url, config);

  const hostname = normalizeHostname(url.hostname);
  url.hostname = hostname;

  validateDomainPolicy(hostname, input, config);

  const resolvedAddresses = await resolveAndValidateHost(hostname, config, options);

  return {
    normalizedUrl: url.toString(),
    hostname,
    resolvedAddresses
  };
}

export async function validateRedirectTarget(
  baseUrl: string,
  location: string,
  config: AppConfig,
  options: UrlPolicyOptions = {}
): Promise<UrlPolicyResult> {
  const nextUrl = new URL(location, baseUrl);
  return validateUrlPolicy({ url: nextUrl.toString() }, config, options);
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new AppError(400, "INVALID_URL", "URL is malformed or unsupported.");
  }
}

function validateScheme(url: URL, config: AppConfig) {
  if (url.protocol === "https:") {
    return;
  }

  if (url.protocol === "http:" && config.ALLOW_HTTP) {
    return;
  }

  throw new AppError(400, "INVALID_URL", "URL scheme is not allowed.", {
    scheme: url.protocol.replace(":", "")
  });
}

function normalizeHostname(hostname: string): string {
  const normalized = domainToASCII(hostname.toLowerCase());

  if (normalized.length === 0) {
    throw new AppError(400, "INVALID_URL", "URL hostname is invalid.");
  }

  return normalized;
}

function validateDomainPolicy(
  hostname: string,
  input: UrlPolicyInput,
  config: AppConfig
) {
  const requestBlocked = normalizeDomainRules(input.blockedDomains ?? []);
  const requestAllowed = normalizeDomainRules(input.allowedDomains ?? []);
  const globalBlocked = normalizeDomainRules(config.blockedDomains);
  const globalAllowed = normalizeDomainRules(config.allowedDomains);

  if (matchesAnyDomain(hostname, [...globalBlocked, ...requestBlocked])) {
    throw new AppError(403, "URL_BLOCKED", "The requested URL is blocked by policy.", {
      reason: "blocked_domain"
    });
  }

  if (globalAllowed.length > 0 && !matchesAnyDomain(hostname, globalAllowed)) {
    throw new AppError(403, "URL_BLOCKED", "The requested URL is blocked by policy.", {
      reason: "not_in_global_allowlist"
    });
  }

  if (requestAllowed.length > 0 && !matchesAnyDomain(hostname, requestAllowed)) {
    throw new AppError(403, "URL_BLOCKED", "The requested URL is blocked by policy.", {
      reason: "not_in_request_allowlist"
    });
  }
}

async function resolveAndValidateHost(
  hostname: string,
  config: AppConfig,
  options: UrlPolicyOptions
): Promise<string[]> {
  if (isLocalhostName(hostname)) {
    throw new AppError(403, "URL_BLOCKED", "The requested URL is blocked by policy.", {
      reason: "localhost"
    });
  }

  if (net.isIP(hostname) !== 0) {
    validateIpAddress(hostname, config);
    return [hostname];
  }

  const lookup = options.lookup ?? defaultLookup;
  const records = await lookup(hostname);
  const addresses = records.map((record) => record.address);

  if (addresses.length === 0) {
    throw new AppError(400, "INVALID_URL", "URL hostname could not be resolved.");
  }

  for (const address of addresses) {
    validateIpAddress(address, config);
  }

  return addresses;
}

function validateIpAddress(address: string, config: AppConfig) {
  if (config.ALLOW_PRIVATE_IPS) {
    return;
  }

  if (isBlockedIp(address)) {
    throw new AppError(403, "URL_BLOCKED", "The requested URL is blocked by policy.", {
      reason: "private_ip_range"
    });
  }
}

function normalizeDomainRules(rules: string[]): string[] {
  return rules.map((rule) => domainToASCII(rule.trim().toLowerCase())).filter(Boolean);
}

function matchesAnyDomain(hostname: string, rules: string[]): boolean {
  return rules.some((rule) => matchesDomain(hostname, rule));
}

function matchesDomain(hostname: string, rule: string): boolean {
  if (rule.startsWith("*.")) {
    const suffix = rule.slice(2);
    return hostname.endsWith(`.${suffix}`) && hostname !== suffix;
  }

  return hostname === rule;
}

function isLocalhostName(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost");
}

function isBlockedIp(address: string): boolean {
  const family = net.isIP(address);

  if (family === 4) {
    return isBlockedIpv4(address);
  }

  if (family === 6) {
    return isBlockedIpv6(address);
  }

  return true;
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToNumber(address);

  return (
    inIpv4Range(value, "0.0.0.0", 8) ||
    inIpv4Range(value, "10.0.0.0", 8) ||
    inIpv4Range(value, "127.0.0.0", 8) ||
    inIpv4Range(value, "169.254.0.0", 16) ||
    inIpv4Range(value, "172.16.0.0", 12) ||
    inIpv4Range(value, "192.168.0.0", 16) ||
    inIpv4Range(value, "224.0.0.0", 4) ||
    inIpv4Range(value, "240.0.0.0", 4)
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("ff")
  );
}

function ipv4ToNumber(address: string): number {
  return address
    .split(".")
    .map(Number)
    .reduce((accumulator, octet) => (accumulator << 8) + octet, 0) >>> 0;
}

function inIpv4Range(address: number, base: string, prefix: number): boolean {
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (ipv4ToNumber(base) & mask);
}
