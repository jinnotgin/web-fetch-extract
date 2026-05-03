export function normalizeContentType(contentType: string | undefined): string {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isHtmlContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  return normalized === "text/html" || normalized === "application/xhtml+xml";
}

export function isPlainTextContentType(contentType: string): boolean {
  return normalizeContentType(contentType) === "text/plain";
}

export function isPdfContentType(contentType: string): boolean {
  return normalizeContentType(contentType) === "application/pdf";
}

export function isImageContentType(contentType: string): boolean {
  return normalizeContentType(contentType).startsWith("image/");
}
