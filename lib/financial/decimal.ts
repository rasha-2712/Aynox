import type { DecimalString } from "@/types/financial";

const DECIMAL_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/;
/** Bounds provider-derived BigInt work while allowing amounts far beyond ordinary issuer financials. */
export const MAX_DECIMAL_INTEGER_DIGITS = 120;
export const MAX_DECIMAL_FRACTIONAL_SCALE = 24;
export const MAX_DECIMAL_INPUT_LENGTH = 146;
export const MAX_DIVISION_PRECISION = 24;
export type DecimalRoundingMode = "half-up-away-from-zero";
export type DecimalComparison = -1 | 0 | 1;
export type DecimalDivisionResult =
  | { status: "calculated"; value: DecimalString; decimalPlaces: number; roundingMode: DecimalRoundingMode }
  | { status: "zero_denominator" };

interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

export type DecimalParseResult =
  | { status: "valid"; value: DecimalString }
  | { status: "invalid"; reason: "malformed" | "input-too-long" | "integer-too-large" | "scale-too-large" };

export class DecimalInputError extends TypeError {
  constructor(readonly code: Extract<DecimalParseResult, { status: "invalid" }>["reason"]) {
    super(`Decimal input rejected: ${code}.`);
    this.name = "DecimalInputError";
  }
}

export function parseDecimalStringResult(value: string): DecimalParseResult {
  const reason = decimalInputError(value);
  if (reason) return { status: "invalid", reason };
  return { status: "valid", value: normalizeDecimal(value) as DecimalString };
}

/** Parse and canonicalize a base-10 decimal without converting through Number. */
export function parseDecimalString(value: string): DecimalString | null {
  const result = parseDecimalStringResult(value);
  return result.status === "valid" ? result.value : null;
}

export function isDecimalString(value: string): value is DecimalString {
  return parseDecimalString(value) !== null;
}

export function addDecimalStrings(left: string, right: string): DecimalString {
  const [a, b, scale] = align(parseParts(left), parseParts(right));
  return fromParts(a + b, scale) as DecimalString;
}

export function subtractDecimalStrings(left: string, right: string): DecimalString {
  const [a, b, scale] = align(parseParts(left), parseParts(right));
  return fromParts(a - b, scale) as DecimalString;
}

export function multiplyDecimalStrings(left: string, right: string): DecimalString {
  const a = parseParts(left);
  const b = parseParts(right);
  return fromParts(a.coefficient * b.coefficient, a.scale + b.scale) as DecimalString;
}

/** Divide and explicitly quantize to decimalPlaces using half-up, ties away from zero. */
export function divideDecimalStrings(
  numerator: string,
  denominator: string,
  decimalPlaces: number,
  roundingMode: DecimalRoundingMode = "half-up-away-from-zero"
): DecimalDivisionResult {
  validatePrecision(decimalPlaces);
  validateRoundingMode(roundingMode);
  const a = parseParts(numerator);
  const b = parseParts(denominator);
  if (b.coefficient === BigInt(0)) return { status: "zero_denominator" };

  let scaledNumerator = a.coefficient * pow10(b.scale + decimalPlaces);
  let scaledDenominator = b.coefficient * pow10(a.scale);
  if (scaledDenominator < BigInt(0)) {
    scaledNumerator = -scaledNumerator;
    scaledDenominator = -scaledDenominator;
  }
  const negative = scaledNumerator < BigInt(0);
  const absoluteNumerator = negative ? -scaledNumerator : scaledNumerator;
  const quotient = absoluteNumerator / scaledDenominator;
  const remainder = absoluteNumerator % scaledDenominator;
  const rounded = remainder * BigInt(2) >= scaledDenominator ? quotient + BigInt(1) : quotient;
  const coefficient = negative ? -rounded : rounded;
  return {
    status: "calculated",
    value: fromParts(coefficient, decimalPlaces) as DecimalString,
    decimalPlaces,
    roundingMode
  };
}

/** Compute (numerator / denominator) × 100 without materializing an oversized numerator. */
export function divideDecimalRatioAsPercentage(
  numerator: string,
  denominator: string,
  decimalPlaces: number,
  roundingMode: DecimalRoundingMode = "half-up-away-from-zero"
): DecimalDivisionResult {
  validatePrecision(decimalPlaces);
  validateRoundingMode(roundingMode);
  if (decimalPlaces + 2 > MAX_DIVISION_PRECISION) throw new RangeError("Percentage precision exceeds the supported division limit.");
  const ratio = divideDecimalStrings(numerator, denominator, decimalPlaces + 2, roundingMode);
  if (ratio.status === "zero_denominator") return ratio;
  const parts = parseParts(ratio.value);
  const value = parts.scale >= 2
    ? fromParts(parts.coefficient, parts.scale - 2)
    : fromParts(parts.coefficient * pow10(2 - parts.scale), 0);
  return { status: "calculated", value: value as DecimalString, decimalPlaces, roundingMode };
}

export function compareDecimalStrings(left: string, right: string): DecimalComparison {
  const [a, b] = align(parseParts(left), parseParts(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

export function absoluteDecimalString(value: string): DecimalString {
  const parts = parseParts(value);
  return fromParts(parts.coefficient < BigInt(0) ? -parts.coefficient : parts.coefficient, parts.scale) as DecimalString;
}

/** Quantize explicitly; values with more fractional digits are rounded, never silently truncated. */
export function roundDecimalString(
  value: string,
  decimalPlaces: number,
  roundingMode: DecimalRoundingMode = "half-up-away-from-zero"
): DecimalString {
  validatePrecision(decimalPlaces);
  validateRoundingMode(roundingMode);
  const parts = parseParts(value);
  if (parts.scale <= decimalPlaces) return fromParts(parts.coefficient * pow10(decimalPlaces - parts.scale), decimalPlaces) as DecimalString;
  const divisor = pow10(parts.scale - decimalPlaces);
  const negative = parts.coefficient < BigInt(0);
  const absolute = negative ? -parts.coefficient : parts.coefficient;
  let quotient = absolute / divisor;
  const remainder = absolute % divisor;
  if (remainder * BigInt(2) >= divisor) quotient += BigInt(1);
  return fromParts(negative ? -quotient : quotient, decimalPlaces) as DecimalString;
}

function parseParts(value: string): DecimalParts {
  const reason = decimalInputError(value);
  if (reason) throw new DecimalInputError(reason);
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw new TypeError("Invalid decimal input.");
  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const fraction = match[3] ?? "";
  return { coefficient: sign * BigInt(`${match[2]}${fraction}`), scale: fraction.length };
}

function decimalInputError(value: unknown): Extract<DecimalParseResult, { status: "invalid" }>["reason"] | null {
  if (typeof value !== "string") return "malformed";
  if (value.length > MAX_DECIMAL_INPUT_LENGTH) return "input-too-long";
  if (!DECIMAL_PATTERN.test(value)) return "malformed";
  const fraction = value.split(".")[1] ?? "";
  const integer = value.replace(/^-/, "").split(".")[0];
  if (integer.length > MAX_DECIMAL_INTEGER_DIGITS) return "integer-too-large";
  if (fraction.length > MAX_DECIMAL_FRACTIONAL_SCALE) return "scale-too-large";
  return null;
}

function validatePrecision(decimalPlaces: number): void {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > MAX_DIVISION_PRECISION) {
    throw new RangeError(`Decimal precision must be an integer from 0 to ${MAX_DIVISION_PRECISION}.`);
  }
}

function validateRoundingMode(roundingMode: DecimalRoundingMode): void {
  if (roundingMode !== "half-up-away-from-zero") throw new RangeError("Unsupported decimal rounding mode.");
}

function align(a: DecimalParts, b: DecimalParts): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [a.coefficient * pow10(scale - a.scale), b.coefficient * pow10(scale - b.scale), scale];
}

function pow10(exponent: number): bigint {
  return BigInt(10) ** BigInt(exponent);
}

function fromParts(coefficient: bigint, scale: number): string {
  if (coefficient === BigInt(0)) return "0";
  const negative = coefficient < BigInt(0);
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? "" : digits.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function normalizeDecimal(value: string): string {
  const parts = parseParts(value);
  return fromParts(parts.coefficient, parts.scale);
}
