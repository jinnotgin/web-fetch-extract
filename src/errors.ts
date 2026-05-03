export type ErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_URL"
  | "UNAUTHORIZED"
  | "URL_BLOCKED"
  | "FETCH_TIMEOUT"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "EXTRACTION_FAILED"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
