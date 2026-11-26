import { parseDecimalString, subtractDecimalStrings } from "@/lib/financial/decimal";
import type { FinancialObservation, ReportingPeriod } from "@/types/financial";

export type PeriodDerivationFailureCode =
  | "wrong-category"
  | "wrong-period-basis"
  | "missing-value"
  | "invalid-decimal"
  | "security-mismatch"
  | "metric-mismatch"
  | "source-mismatch"
  | "currency-mismatch"
  | "unit-mismatch"
  | "scale-mismatch"
  | "reporting-basis-mismatch"
  | "scope-mismatch"
  | "fiscal-calendar-mismatch"
  | "fiscal-year-mismatch"
  | "incomplete-period"
  | "nonconsecutive-quarter"
  | "period-boundary-mismatch"
  | "revision-mismatch"
  | "invalid-date";

export type PeriodDerivationResult =
  | { status: "derived"; observation: FinancialObservation }
  | { status: "unavailable"; code: PeriodDerivationFailureCode; reason: string };

/** Derive one stand-alone quarter from consecutive, compatible cumulative YTD values. */
export function deriveDiscreteQuarterFromYtd(
  previousYtd: FinancialObservation,
  currentYtd: FinancialObservation
): PeriodDerivationResult {
  const fail = (code: PeriodDerivationFailureCode, reason: string): PeriodDerivationResult => ({ status: "unavailable", code, reason });
  if (previousYtd.statementCategory === "balance-sheet" || currentYtd.statementCategory === "balance-sheet") {
    return fail("wrong-category", "Instant balance-sheet observations cannot be converted into flow quarters.");
  }
  if (previousYtd.period.basis !== "year-to-date" || currentYtd.period.basis !== "year-to-date") {
    return fail("wrong-period-basis", "Both input observations must use the year-to-date period basis.");
  }
  if (previousYtd.value === null || currentYtd.value === null) {
    return fail("missing-value", "Both YTD observations must contain reported values; missing values are not zero.");
  }
  if (!parseDecimalString(previousYtd.value) || !parseDecimalString(currentYtd.value)) {
    return fail("invalid-decimal", "Both YTD values must be valid decimal strings.");
  }
  if (previousYtd.securityId !== currentYtd.securityId) return fail("security-mismatch", "Input observations belong to different canonical securities.");
  if (previousYtd.metricKey !== currentYtd.metricKey || previousYtd.statementCategory !== currentYtd.statementCategory) {
    return fail("metric-mismatch", "Input observations must represent the same normalized metric and statement category.");
  }
  if (previousYtd.source.providerId !== currentYtd.source.providerId
      || previousYtd.source.dataset !== currentYtd.source.dataset
      || previousYtd.source.market !== currentYtd.source.market) {
    return fail("source-mismatch", "Input observations must come from the same provider dataset.");
  }
  if (previousYtd.currency !== currentYtd.currency) return fail("currency-mismatch", "Input observations must use the same currency.");
  if (previousYtd.unit !== currentYtd.unit) return fail("unit-mismatch", "Input observations must use the same unit.");
  if (previousYtd.scale !== currentYtd.scale) return fail("scale-mismatch", "Input observations must use the same source scale.");
  if (previousYtd.accountingBasis !== currentYtd.accountingBasis) return fail("reporting-basis-mismatch", "Input observations must use the same reporting/accounting basis.");
  if (previousYtd.consolidationScope !== currentYtd.consolidationScope) return fail("scope-mismatch", "Input observations must use the same consolidation scope.");
  if (previousYtd.period.fiscalCalendarId !== currentYtd.period.fiscalCalendarId) return fail("fiscal-calendar-mismatch", "Input observations must use the same issuer fiscal calendar.");
  if (previousYtd.period.fiscalYearId !== currentYtd.period.fiscalYearId) return fail("fiscal-year-mismatch", "Input observations must belong to the same issuer fiscal year.");
  const requiredDates = [previousYtd.period.start, previousYtd.period.end, previousYtd.period.fiscalYearStart, previousYtd.period.fiscalQuarterEnd,
    currentYtd.period.start, currentYtd.period.end, currentYtd.period.fiscalYearStart,
    currentYtd.period.fiscalQuarterStart, currentYtd.period.fiscalQuarterEnd];
  if (requiredDates.some((value) => !toDate(value))) return fail("invalid-date", "A reporting-period date is not a valid calendar date.");
  if (previousYtd.period.completeness !== "complete" || currentYtd.period.completeness !== "complete") {
    return fail("incomplete-period", "Both YTD observations must represent complete reported periods.");
  }
  if (!compatibleRevision(previousYtd, currentYtd)) {
    return fail("revision-mismatch", "Restated inputs must belong to the same compatible provider revision set.");
  }

  const previousQuarter = previousYtd.period.fiscalQuarterNumber;
  const currentQuarter = currentYtd.period.fiscalQuarterNumber;
  if (previousQuarter === null || currentQuarter === null || previousQuarter < 1 || previousQuarter > 3
      || currentQuarter < 2 || currentQuarter > 4 || currentQuarter !== previousQuarter + 1) {
    return fail("nonconsecutive-quarter", "Input YTD observations must identify consecutive fiscal quarters.");
  }
  const fiscalYearStart = currentYtd.period.fiscalYearStart;
  if (!fiscalYearStart || previousYtd.period.fiscalYearStart !== fiscalYearStart
      || previousYtd.period.start !== fiscalYearStart || currentYtd.period.start !== fiscalYearStart) {
    return fail("period-boundary-mismatch", "Both cumulative periods must begin at the verified fiscal-year start.");
  }
  const previousEnd = toDate(previousYtd.period.end);
  const currentStart = toDate(currentYtd.period.fiscalQuarterStart);
  const currentEnd = toDate(currentYtd.period.end);
  const previousQuarterEnd = toDate(previousYtd.period.fiscalQuarterEnd);
  const currentQuarterEnd = toDate(currentYtd.period.fiscalQuarterEnd);
  if (!previousEnd || !currentStart || !currentEnd || !previousQuarterEnd || !currentQuarterEnd
      || previousQuarterEnd.getTime() !== previousEnd.getTime()
      || currentEnd.getTime() !== currentQuarterEnd.getTime()
      || addDays(previousEnd, 1).getTime() !== currentStart.getTime()
      || currentEnd.getTime() <= previousEnd.getTime()) {
    return fail("period-boundary-mismatch", "The previous YTD endpoint and current fiscal quarter boundaries must be contiguous and complete.");
  }

  const value = subtractDecimalStrings(currentYtd.value, previousYtd.value);
  const period: ReportingPeriod = {
    basis: "discrete-quarter",
    start: currentYtd.period.fiscalQuarterStart,
    end: currentYtd.period.fiscalQuarterEnd!,
    fiscalYearId: currentYtd.period.fiscalYearId,
    fiscalYearStart,
    fiscalYearEnd: currentYtd.period.fiscalYearEnd,
    fiscalYearBoundaryStatus: currentYtd.period.fiscalYearBoundaryStatus,
    fiscalQuarterId: currentYtd.period.fiscalQuarterId,
    fiscalQuarterNumber: currentQuarter,
    fiscalQuarterStart: currentYtd.period.fiscalQuarterStart,
    fiscalQuarterEnd: currentYtd.period.fiscalQuarterEnd,
    fiscalCalendarId: currentYtd.period.fiscalCalendarId,
    sourcePeriodLabel: `Derived ${currentYtd.period.fiscalQuarterId ?? `fiscal Q${currentQuarter}`} from YTD observations`,
    durationDays: daysBetween(currentYtd.period.fiscalQuarterStart!, currentYtd.period.fiscalQuarterEnd!),
    durationWeeks: daysBetween(currentYtd.period.fiscalQuarterStart!, currentYtd.period.fiscalQuarterEnd!) / 7,
    completeness: "complete"
  };
  const observation: FinancialObservation = {
    ...currentYtd,
    id: `derived:${previousYtd.id}:${currentYtd.id}:ytd-to-quarter-v1`,
    value,
    period,
    providerMetricName: currentYtd.providerMetricName,
    source: {
      ...currentYtd.source,
      providerId: "aynox-derived",
      providerName: "Aynox period normalizer",
      dataset: "derived-financial-periods",
      sourceRecordId: `derived:${previousYtd.id}:${currentYtd.id}`,
      upstreamObservationIds: [previousYtd.id, currentYtd.id],
      upstreamSources: [upstreamSource(previousYtd), upstreamSource(currentYtd)],
      entitlements: uniqueEntitlements([...previousYtd.source.entitlements, ...currentYtd.source.entitlements]),
      entitlementIds: [...new Set([...previousYtd.source.entitlementIds, ...currentYtd.source.entitlementIds])]
    },
    derivation: { ruleId: "ytd-to-quarter/v1", observationIds: [previousYtd.id, currentYtd.id] }
  };
  return { status: "derived", observation };
}

function upstreamSource(observation: FinancialObservation) {
  const source = observation.source;
  return {
    observationId: observation.id,
    providerId: source.providerId,
    providerName: source.providerName,
    dataset: source.dataset,
    market: source.market,
    sourceRecordId: source.sourceRecordId,
    sourceUrl: source.sourceUrl,
    asOf: source.asOf,
    retrievedAt: source.retrievedAt,
    dataEnvironment: source.dataEnvironment,
    revision: source.revision,
    entitlements: source.entitlements,
    entitlementIds: source.entitlementIds
  };
}

function uniqueEntitlements(entitlements: FinancialObservation["source"]["entitlements"]) {
  return [...new Map(entitlements.map((entitlement) => [entitlement.id, entitlement])).values()];
}

function compatibleRevision(previous: FinancialObservation, current: FinancialObservation): boolean {
  const priorRevision = previous.source.revision;
  const currentRevision = current.source.revision;
  if (priorRevision.status === "original" && currentRevision.status === "original") return true;
  return priorRevision.status === "restated"
    && currentRevision.status === "restated"
    && Boolean(priorRevision.compatibleSetId)
    && priorRevision.compatibleSetId === currentRevision.compatibleSetId;
}

function toDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function daysBetween(start: string, end: string): number {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
}
