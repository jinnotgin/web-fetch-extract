export type ErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_URL"
  | "UNAUTHORIZED"
  | "URL_BLOCKED"
  | "UNSUPPORTED_CONTENT_TYPE"
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
