import {
  compareDecimalStrings, divideDecimalRatioAsPercentage, divideDecimalStrings, subtractDecimalStrings
} from "@/lib/financial/decimal";
import { getFinancialFormula, isFormulaDefinitionSupported } from "@/lib/financial/formula-catalogue";
import { evaluateDataPermission } from "@/lib/financial/permissions";
import { validateFinancialObservation } from "@/lib/financial/validation";
import type {
  DataConsumerContext, FinancialCalculationResult, FinancialCalculationStatus,
  FinancialMetricId, FinancialObservation
} from "@/types/financial";

export interface FinancialCalculationContext {
  consumer: DataConsumerContext;
  calculatedAt: string;
}

/** Provider-neutral calculations over validated normalized observations. No UI, provider, or AI code is used here. */
export function calculateFinancialMetric(
  metricId: FinancialMetricId,
  observations: FinancialObservation[],
  context: FinancialCalculationContext
): FinancialCalculationResult {
  const malformedCollection = !Array.isArray(observations)
    || observations.some((observation) => observation === null || typeof observation !== "object");
  const safeObservations = Array.isArray(observations)
    ? observations.filter((observation): observation is FinancialObservation => observation !== null && typeof observation === "object")
    : [];
  const formula = getFinancialFormula(metricId);
  const base = resultBase(metricId, safeObservations, context, formula.rounding);
  if (!isFormulaDefinitionSupported(formula)) return finish(base, "unsupported_definition", "Catalogue metadata does not match a registered calculation implementation and test contract.");
  if (formula.implementationStatus === "blocked-open-definition") {
    return finish(base, "unsupported_definition", `D-34 leaves this metric definition open: ${formula.unsupportedConditions[0]}.`);
  }
  if (!isValidContext(context)) return finish(base, "invalid_input", "Calculation timestamp or consumer context is invalid.");
  if (malformedCollection) return finish(base, "invalid_input", "Input observations must be an array of observation objects.");

  const requiredCount = formula.requiredMetricKeys.length;
  if (safeObservations.length < requiredCount) {
    const status = metricId === "revenue-growth" && safeObservations.length === 1 ? "insufficient_history" : "missing_inputs";
    return finish(base, status, `Expected ${requiredCount} compatible input observation(s); received ${safeObservations.length}.`);
  }
  if (safeObservations.length !== requiredCount) return finish(base, "invalid_input", "Input count does not match the versioned formula definition.");
  if (safeObservations.some((observation) => validateFinancialObservation(observation).length > 0)) {
    return finish(base, "invalid_input", "One or more input observations failed domain validation.");
  }
  if (safeObservations.some((observation, index) => observation.metricKey !== formula.requiredMetricKeys[index]
      || observation.unit !== formula.requiredUnits[index]
      || !formula.allowedPeriodBases.includes(observation.period.basis))) {
    return finish(base, "incompatible_units", "Input metric key, unit, or reporting-period basis does not satisfy the formula catalogue.");
  }
  if (safeObservations.some((observation) => observation.metricMappingStatus !== "verified")) {
    return finish(base, "unsupported_definition", "A required source field does not have an explicitly verified mapping to its normalized metric.");
  }
  if (safeObservations.some((observation) => observation.value === null)) {
    return finish(base, "missing_inputs", "A required reported value is missing; missing values are not treated as zero.");
  }
  if (new Set(safeObservations.map((observation) => observation.id)).size !== safeObservations.length) {
    return finish(base, "invalid_input", "Input observations must have distinct evidence IDs.");
  }
  if (new Set(safeObservations.map((observation) => observation.securityId)).size !== 1) {
    return finish(base, "incompatible_scope", "All inputs must belong to the same canonical security.");
  }
  if (!hasDerivationPermission(safeObservations, context)) {
    return finish(base, "permission_denied", "A source entitlement does not authorize this calculation in the requested environment and audience.");
  }

  if (metricId === "operating-cash-flow") return calculateOperatingCashFlow(base, safeObservations[0]);
  if (metricId === "revenue-growth") return calculateRevenueGrowth(base, safeObservations[0], safeObservations[1]);
  if (metricId === "gross-margin") return calculateMargin(base, safeObservations[0], safeObservations[1], "gross-profit", "revenue");
  if (metricId === "operating-margin") return calculateMargin(base, safeObservations[0], safeObservations[1], "operating-income", "revenue");
  if (metricId === "current-ratio") return calculateCurrentRatio(base, safeObservations[0], safeObservations[1]);
  return finish(base, "unsupported_definition", "No deterministic implementation is enabled for this open metric definition.");
}

function calculateOperatingCashFlow(base: FinancialCalculationResult, observation: FinancialObservation): FinancialCalculationResult {
  if (observation.statementCategory !== "cash-flow" || observation.metricKey !== "operating-cash-flow") return finish(base, "missing_inputs", "The source-reported operating cash-flow field is missing or unmapped.");
  if (!["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"].includes(observation.period.basis)) return finish(base, "incompatible_periods", "Operating cash flow requires a flow reporting period.");
  if (!isCurrencyAmount(observation)) return finish(base, "incompatible_units", "Operating cash flow must have a known currency unit, currency, and scale.");
  return finish(base, "calculated", undefined, observation.value, {
    securityId: observation.securityId, reportingPeriod: observation.period, periodType: observation.period.basis,
    currency: observation.currency, scale: observation.scale
  });
}

function calculateRevenueGrowth(base: FinancialCalculationResult, current: FinancialObservation, prior: FinancialObservation): FinancialCalculationResult {
  if (current.statementCategory !== "income-statement" || prior.statementCategory !== "income-statement"
      || current.metricKey !== "revenue" || prior.metricKey !== "revenue") return finish(base, "missing_inputs", "Both source fields must be mapped to income-statement revenue.");
  const compatibility = compatibleAmounts(current, prior);
  if (compatibility) return finish(base, compatibility.status, compatibility.reason);
  if (!isComparableYearOverYear(current, prior)) return finish(base, "incompatible_periods", "Revenue observations must be the same reporting-period basis and immediately comparable fiscal period in adjacent fiscal years.");
  if (compareDecimalStrings(prior.value!, "0") === 0) return finish(base, "zero_denominator", "Prior-period revenue is zero, so growth is undefined.");
  if (compareDecimalStrings(prior.value!, "0") < 0) return finish(base, "not_meaningful", "Negative comparison-period revenue is not interpreted as ordinary revenue growth under the proposed definition.");
  if (compareDecimalStrings(current.value!, "0") < 0) return finish(base, "unsupported_definition", "Negative current revenue requires an approved metric-mapping interpretation.");
  const numerator = subtractDecimalStrings(current.value!, prior.value!);
  const quotient = dividePercentageForFormula(numerator, prior.value!, base.rounding);
  if (quotient.status === "zero_denominator") return finish(base, "zero_denominator", "Prior-period revenue is zero, so growth is undefined.");
  return finish(base, "calculated", undefined, quotient.value, {
    securityId: current.securityId, reportingPeriod: current.period, periodType: current.period.basis, unit: "percentage"
  });
}

function calculateMargin(
  base: FinancialCalculationResult,
  numerator: FinancialObservation,
  denominator: FinancialObservation,
  numeratorKey: "gross-profit" | "operating-income",
  denominatorKey: "revenue"
): FinancialCalculationResult {
  if (numerator.statementCategory !== "income-statement" || denominator.statementCategory !== "income-statement"
      || numerator.metricKey !== numeratorKey || denominator.metricKey !== denominatorKey) return finish(base, "missing_inputs", "Required normalized income-statement numerator or revenue field is missing.");
  const compatibility = compatibleAmounts(numerator, denominator);
  if (compatibility) return finish(base, compatibility.status, compatibility.reason);
  if (!sameFlowPeriod(numerator, denominator)) return finish(base, "incompatible_periods", "Margin numerator and denominator must describe the same complete fiscal flow period.");
  if (compareDecimalStrings(denominator.value!, "0") === 0) return finish(base, "zero_denominator", "Revenue is zero, so the margin is undefined.");
  if (compareDecimalStrings(denominator.value!, "0") < 0) return finish(base, "not_meaningful", "Revenue must be positive for the proposed margin definition.");
  const quotient = dividePercentageForFormula(numerator.value!, denominator.value!, base.rounding);
  if (quotient.status === "zero_denominator") return finish(base, "zero_denominator", "Revenue is zero, so the margin is undefined.");
  return finish(base, "calculated", undefined, quotient.value, {
    securityId: numerator.securityId, reportingPeriod: numerator.period, periodType: numerator.period.basis, unit: "percentage"
  });
}

function calculateCurrentRatio(base: FinancialCalculationResult, assets: FinancialObservation, liabilities: FinancialObservation): FinancialCalculationResult {
  if (assets.metricKey !== "current-assets" || liabilities.metricKey !== "current-liabilities") return finish(base, "missing_inputs", "Current assets and current liabilities must both be mapped.");
  if (assets.statementCategory !== "balance-sheet" || liabilities.statementCategory !== "balance-sheet"
      || assets.period.basis !== "instant" || liabilities.period.basis !== "instant") {
    return finish(base, "incompatible_periods", "Current-ratio inputs must be instantaneous balance-sheet observations.");
  }
  const compatibility = compatibleAmounts(assets, liabilities);
  if (compatibility) return finish(base, compatibility.status, compatibility.reason);
  if (assets.period.end !== liabilities.period.end) return finish(base, "incompatible_periods", "Current-ratio balances must have the same statement date.");
  if (compareDecimalStrings(liabilities.value!, "0") === 0) return finish(base, "zero_denominator", "Current liabilities are zero, so the ratio is undefined.");
  if (compareDecimalStrings(liabilities.value!, "0") < 0) return finish(base, "not_meaningful", "Current liabilities must be positive for the proposed ratio definition.");
  if (compareDecimalStrings(assets.value!, "0") < 0) return finish(base, "invalid_input", "Negative current assets require source validation and are withheld.");
  const quotient = divideForFormula(assets.value!, liabilities.value!, base.rounding);
  if (quotient.status === "zero_denominator") return finish(base, "zero_denominator", "Current liabilities are zero, so the ratio is undefined.");
  return finish(base, "calculated", undefined, quotient.value, {
    securityId: assets.securityId, reportingPeriod: assets.period, periodType: "instant", unit: "ratio"
  });
}

function compatibleAmounts(a: FinancialObservation, b: FinancialObservation): { status: FinancialCalculationStatus; reason: string } | null {
  if (!isCurrencyAmount(a) || !isCurrencyAmount(b)) return { status: "incompatible_units", reason: "Inputs must be known currency amounts with valid source scales." };
  if (a.currency !== b.currency) return { status: "incompatible_currency", reason: "Currency conversion is not supported by this calculation engine." };
  if (a.scale !== b.scale) return { status: "incompatible_units", reason: "Input source scales differ and are not silently normalized." };
  if (a.accountingBasis !== b.accountingBasis || a.consolidationScope !== b.consolidationScope) {
    return { status: "incompatible_scope", reason: "Accounting basis and consolidation scope must match exactly." };
  }
  if (a.period.completeness !== "complete" || b.period.completeness !== "complete") {
    return { status: "incompatible_periods", reason: "Both periods must be complete." };
  }
  return null;
}

function sameFlowPeriod(a: FinancialObservation, b: FinancialObservation): boolean {
  return a.statementCategory !== "balance-sheet" && b.statementCategory !== "balance-sheet"
    && a.period.basis === b.period.basis
    && a.period.start === b.period.start && a.period.end === b.period.end
    && a.period.fiscalYearId === b.period.fiscalYearId
    && a.period.fiscalYearStart === b.period.fiscalYearStart
    && a.period.fiscalQuarterId === b.period.fiscalQuarterId
    && a.period.fiscalQuarterNumber === b.period.fiscalQuarterNumber
    && a.period.fiscalQuarterStart === b.period.fiscalQuarterStart
    && a.period.fiscalQuarterEnd === b.period.fiscalQuarterEnd
    && a.period.fiscalCalendarId === b.period.fiscalCalendarId;
}

function isComparableYearOverYear(current: FinancialObservation, prior: FinancialObservation): boolean {
  const cp = current.period;
  const pp = prior.period;
  if (cp.basis !== pp.basis || !cp.fiscalYearId || !pp.fiscalYearId || cp.fiscalYearId === pp.fiscalYearId
      || !cp.fiscalCalendarId || cp.fiscalCalendarId !== pp.fiscalCalendarId
      || !cp.fiscalYearStart || !pp.fiscalYearStart) return false;
  const currentStart = Date.parse(`${cp.fiscalYearStart}T00:00:00.000Z`);
  const priorStart = Date.parse(`${pp.fiscalYearStart}T00:00:00.000Z`);
  const yearDays = Math.abs(currentStart - priorStart) / 86_400_000;
  if (!Number.isInteger(yearDays) || yearDays < 364 || yearDays > 371) return false;
  if (cp.basis === "annual") {
    if (cp.fiscalYearBoundaryStatus !== "source-verified" || pp.fiscalYearBoundaryStatus !== "source-verified"
        || !cp.fiscalYearEnd || !pp.fiscalYearEnd || cp.start !== cp.fiscalYearStart || pp.start !== pp.fiscalYearStart
        || cp.end !== cp.fiscalYearEnd || pp.end !== pp.fiscalYearEnd) return false;
    const currentEnd = Date.parse(`${cp.fiscalYearEnd}T00:00:00.000Z`);
    const priorEnd = Date.parse(`${pp.fiscalYearEnd}T00:00:00.000Z`);
    const currentDuration = (currentEnd - currentStart) / 86_400_000 + 1;
    const priorDuration = (priorEnd - priorStart) / 86_400_000 + 1;
    const contiguous = currentStart === priorEnd + 86_400_000;
    return contiguous && [currentDuration, priorDuration].every((days) => Number.isInteger(days) && days >= 364 && days <= 371);
  }
  if (cp.basis !== "discrete-quarter" && cp.basis !== "year-to-date") return false;
  return cp.fiscalQuarterNumber !== null && cp.fiscalQuarterNumber === pp.fiscalQuarterNumber;
}

function isCurrencyAmount(observation: FinancialObservation): boolean {
  return observation.unit === "currency" && Boolean(observation.currency)
    && observation.scale !== "unknown";
}

function hasDerivationPermission(observations: FinancialObservation[], context: FinancialCalculationContext): boolean {
  return observations.every((observation) => observation.source.entitlements.length > 0
    && observation.source.entitlements.every((entitlement) => evaluateDataPermission(
      [entitlement],
      { providerId: entitlement.providerId, dataset: entitlement.dataset, market: entitlement.market, contractRef: entitlement.contractRef, contractVersion: entitlement.contractVersion },
      "derivation", context.calculatedAt, context.consumer
    ).allowed));
}

function resultBase(
  metricId: FinancialMetricId,
  observations: FinancialObservation[],
  context: FinancialCalculationContext,
  rounding: FinancialCalculationResult["rounding"]
): FinancialCalculationResult {
  const formula = getFinancialFormula(metricId);
  const inputs = observations ?? [];
  const inputObservationIds = inputs.map((item) => item.id);
  const evidenceIds = [...new Set(inputs.flatMap((item) => [
    item.id,
    item.source?.sourceRecordId,
    ...(item.source?.upstreamObservationIds ?? []),
    ...(item.source?.upstreamSources ?? []).map((source) => source.sourceRecordId)
  ].filter((id): id is string => Boolean(id))))];
  return {
    id: `calculation:${metricId}:${formula.formulaVersion}:${inputObservationIds.join(":")}`,
    metricId, displayName: formula.displayName, definitionStatus: "proposed-open",
    securityId: inputs[0]?.securityId ?? null, value: null, unit: metricId === "operating-cash-flow" ? "currency" : "unknown",
    currency: null, scale: null, reportingPeriod: inputs[0]?.period ?? null, periodType: inputs[0]?.period?.basis ?? null,
    formulaIdentifier: formula.formulaIdentifier, formulaVersion: formula.formulaVersion,
    inputObservationIds, evidenceIds,
    calculationTimestamp: typeof context?.calculatedAt === "string" ? context.calculatedAt : "",
    rounding, status: "invalid_input"
  };
}

function finish(
  base: FinancialCalculationResult,
  status: FinancialCalculationStatus,
  explanation?: string,
  value: FinancialCalculationResult["value"] = null,
  overrides: Partial<Pick<FinancialCalculationResult, "securityId" | "reportingPeriod" | "periodType" | "unit" | "currency" | "scale">> = {}
): FinancialCalculationResult {
  return { ...base, ...overrides, value: status === "calculated" ? value : null, status, explanation };
}

function isValidContext(context: FinancialCalculationContext): boolean {
  return Boolean(context && Number.isFinite(Date.parse(context.calculatedAt))
    && context.consumer && ["synthetic", "development-restricted", "production-licensed"].includes(context.consumer.environment)
    && ["internal", "named-customer", "public", "demo-only"].includes(context.consumer.audience));
}

function divideForFormula(
  numerator: string,
  denominator: string,
  rounding: FinancialCalculationResult["rounding"]
) {
  if (rounding.mode !== "half-up-away-from-zero" || rounding.calculationDecimalPlaces === null) {
    throw new TypeError("A division formula must declare a supported rounding mode and precision.");
  }
  return divideDecimalStrings(numerator, denominator, rounding.calculationDecimalPlaces, rounding.mode);
}

function dividePercentageForFormula(
  numerator: string,
  denominator: string,
  rounding: FinancialCalculationResult["rounding"]
) {
  if (rounding.mode !== "half-up-away-from-zero" || rounding.calculationDecimalPlaces === null) {
    throw new TypeError("A percentage formula must declare a supported rounding mode and precision.");
  }
  return divideDecimalRatioAsPercentage(numerator, denominator, rounding.calculationDecimalPlaces, rounding.mode);
}

