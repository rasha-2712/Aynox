/** Article IDs are opaque strings; reject malformed values without rewriting their identity. */
export function isValidNewsArticleId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim().length > 0 && value === value.trim();
}
