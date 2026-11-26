/** Formats a decimal illustrative confidence score as a whole-number percentage. */
export function formatIllustrativeConfidence(confidence: number): string {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError("Illustrative confidence must be a finite decimal between 0 and 1.");
  }
  return `${Math.round(confidence * 100)}%`;
}
