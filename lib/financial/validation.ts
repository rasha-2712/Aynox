import { isDecimalString } from "@/lib/financial/decimal";
import type {
  DataEntitlement, DataEnvironment, ProviderResult, ProviderValidationIssue, ReportingPeriod
} from "@/types/financial";

const environments: DataEnvironment[] = ["synthetic", "development-restricted", "production-licensed"];
const categories = ["income-statement", "balance-sheet", "cash-flow"];
const units = ["currency", "shares", "currency-per-share", "percentage", "ratio", "count", "unknown"];
const scales = ["units", "thousands", "millions", "billions", "unknown"];
const periodBases = ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month", "instant"];
const revisionStatuses = ["original", "restated", "unknown"];
const audiences = ["internal", "named-customer", "public", "demo-only"];
const permissionStates = ["allowed", "denied", "conditional", "unverified"];

export function validateFinancialObservation(input: unknown): ProviderValidationIssue[] {
  const observationId = isRecord(input) && typeof input.id === "string" && input.id.trim() ? input.id : null;
  const issues: ProviderValidationIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ observationId, path, code, message });
  if (!isRecord(input)) return [{ observationId: null, path: "observation", code: "INVALID_OBSERVATION", message: "Observation must be an object." }];

  for (const field of ["id", "securityId", "metricKey", "providerMetricName"] as const) {
    if (!isNonEmptyString(input[field])) add(field, "REQUIRED_FIELD", "Required identifier or metric field is missing.");
  }
  if (!["verified", "unverified", "ambiguous"].includes(String(input.metricMappingStatus))) {
    add("metricMappingStatus", "INVALID_METRIC_MAPPING", "Metric mapping status must be explicitly verified, unverified, or ambiguous.");
  }
  if (input.value !== null && (typeof input.value !== "string" || !isDecimalString(input.value))) {
    add("value", "INVALID_DECIMAL", "Value must be a canonical decimal string or null for missing data.");
  }
  if (!categories.includes(String(input.statementCategory))) add("statementCategory", "INVALID_CATEGORY", "Statement category is unsupported.");
  if (!units.includes(String(input.unit))) add("unit", "INVALID_UNIT", "Financial unit is unsupported.");
  if (!scales.includes(String(input.scale))) add("scale", "INVALID_SCALE", "Financial scale is unsupported.");
  if ((input.unit === "currency" || input.unit === "currency-per-share") && !isNonEmptyString(input.currency)) {
    add("currency", "MISSING_CURRENCY", "Currency is required for currency-denominated values.");
  }
  if (input.currency !== null && input.currency !== undefined && (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency))) {
    add("currency", "INVALID_CURRENCY", "Currency must be a three-letter uppercase code.");
  }
  if (!isNonEmptyString(input.accountingBasis)) add("accountingBasis", "MISSING_ACCOUNTING_BASIS", "Accounting basis is required.");
  if (!isNonEmptyString(input.consolidationScope)) add("consolidationScope", "MISSING_CONSOLIDATION_SCOPE", "Consolidation scope is required.");

  validatePeriod(input.period, input.statementCategory, observationId, add);
  validateProvenance(input.source, observationId, add, true);
  return issues;
}

/** Shared adapter boundary: consumers receive data only after the complete response validates. */
export function validateProviderResponse(
  input: unknown,
  validateData: (value: unknown) => ProviderValidationIssue[]
): ProviderValidationIssue[] {
  if (!isRecord(input)) return [{ observationId: null, path: "response", code: "INVALID_PROVIDER_RESPONSE", message: "Provider response must be an object." }];
  const issues: ProviderValidationIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ observationId: null, path, code, message });
  if (!["complete", "partial", "unavailable", "error"].includes(String(input.status))) add("status", "INVALID_PROVIDER_STATUS", "Provider response status is unsupported.");
  if (!isRecord(input.provider) || !isNonEmptyString(input.provider.id) || !isNonEmptyString(input.provider.name) || typeof input.provider.isDemo !== "boolean") {
    add("provider", "INVALID_PROVIDER_IDENTITY", "Provider identity metadata is incomplete.");
  }
  if (!isRecord(input.coverage) || !["supported", "partial", "unsupported", "ambiguous"].includes(String(input.coverage.status))
      || !Array.isArray(input.coverage.supportedFields) || !Array.isArray(input.coverage.missingFields)) {
    add("coverage", "INVALID_PROVIDER_COVERAGE", "Provider coverage metadata is invalid.");
  }
  if (!isTimestamp(input.retrievedAt)) add("retrievedAt", "INVALID_TIMESTAMP", "Provider retrieval timestamp is invalid.");
  if (!environments.includes(input.dataEnvironment as DataEnvironment)) add("dataEnvironment", "INVALID_ENVIRONMENT", "Provider data environment is missing or unsupported.");
  if (!Array.isArray(input.entitlements)) add("entitlements", "INVALID_ENTITLEMENTS", "Provider entitlement records are required.");
  else {
    input.entitlements.forEach((entitlement, index) => validateEntitlement(entitlement as DataEntitlement, `entitlements[${index}]`, add));
    if (environments.includes(input.dataEnvironment as DataEnvironment)
        && input.entitlements.some((entitlement) => isRecord(entitlement) && entitlement.dataEnvironment !== input.dataEnvironment)) {
      add("entitlements", "PROVIDER_ENTITLEMENT_ENVIRONMENT_MISMATCH", "Provider response and entitlement data environments must agree.");
    }
  }
  if ((input.status === "complete" || input.status === "partial") && input.data === null) add("data", "MISSING_PROVIDER_DATA", "Successful provider responses must contain validated data.");
  if (input.data !== null && input.data !== undefined) issues.push(...validateData(input.data));
  return issues;
}

export function validatedProviderResult<T>(
  candidate: ProviderResult<T>,
  validateData: (value: unknown) => ProviderValidationIssue[]
): ProviderResult<T> {
  const issues = validateProviderResponse(candidate, validateData);
  if (issues.length === 0) return candidate;
  return {
    ...candidate,
    status: "error",
    coverage: { status: "partial", supportedFields: [], missingFields: ["provider data failed validation"] },
    data: null,
    failure: {
      code: "PROVIDER_DATA_VALIDATION_FAILED",
      message: "Provider data failed structural and provenance validation.",
      issues
    }
  };
}

export function validateFinancialStatementBundle(input: unknown): ProviderValidationIssue[] {
  if (!isRecord(input)) return [{ observationId: null, path: "data", code: "INVALID_BUNDLE", message: "Financial statement bundle must be an object." }];
  const issues: ProviderValidationIssue[] = [];
  for (const sectionName of ["incomeStatement", "balanceSheet", "cashFlow"] as const) {
    const section = input[sectionName];
    if (!isRecord(section)) {
      issues.push({ observationId: null, path: sectionName, code: "INVALID_SECTION", message: "Statement section is missing or invalid." });
      continue;
    }
    if (!(["complete", "partial", "unavailable", "error"] as string[]).includes(String(section.status))) {
      issues.push({ observationId: null, path: `${sectionName}.status`, code: "INVALID_SECTION_STATUS", message: "Statement section status is unsupported." });
    }
    if (!Array.isArray(section.observations)) {
      issues.push({ observationId: null, path: `${sectionName}.observations`, code: "INVALID_OBSERVATIONS", message: "Statement observations must be an array." });
      continue;
    }
    if (!Array.isArray(section.missingFields) || section.missingFields.some((item) => typeof item !== "string")) {
      issues.push({ observationId: null, path: `${sectionName}.missingFields`, code: "INVALID_COVERAGE", message: "Missing-field coverage must be a string array." });
    }
    section.observations.forEach((observation, index) => {
      const observationIssues = validateFinancialObservation(observation);
      for (const issue of observationIssues) issues.push({ ...issue, path: `${sectionName}.observations[${index}].${issue.path}` });
      const expectedCategory = sectionName === "incomeStatement" ? "income-statement" : sectionName === "balanceSheet" ? "balance-sheet" : "cash-flow";
      if (isRecord(observation) && observation.statementCategory !== expectedCategory) {
        issues.push({ observationId: typeof observation.id === "string" ? observation.id : null, path: `${sectionName}.observations[${index}].statementCategory`, code: "SECTION_CATEGORY_MISMATCH", message: "Observation category does not match its containing section." });
      }
    });
  }
  return issues;
}

export function validateCompanyProfileRecord(input: unknown): ProviderValidationIssue[] {
  if (!isRecord(input)) return [{ observationId: null, path: "data", code: "INVALID_PROFILE", message: "Company profile must be an object." }];
  const issues: ProviderValidationIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ observationId: null, path, code, message });
  for (const field of ["securityId", "canonicalSymbol", "exchange", "companyName"] as const) {
    if (!isNonEmptyString(input[field])) add(field, "REQUIRED_FIELD", "Required company identity field is missing.");
  }
  if (!Array.isArray(input.facts)) add("facts", "INVALID_FACTS", "Company facts must be an array.");
  else input.facts.forEach((fact, index) => {
    if (!isRecord(fact) || !isNonEmptyString(fact.field) || !isNonEmptyString(fact.providerField)
        || (fact.value !== null && typeof fact.value !== "string")
        || (fact.asOf !== null && !isTimestamp(fact.asOf))) {
      add(`facts[${index}]`, "INVALID_FACT", "Company profile fact is incomplete or malformed.");
    }
  });
  validateProvenance(input.source, null, add, false);
  return issues;
}

function validatePeriod(
  input: unknown,
  category: unknown,
  observationId: string | null,
  add: (path: string, code: string, message: string) => void
): void {
  if (!isRecord(input)) {
    add("period", "INVALID_PERIOD", "Reporting period must be an object.");
    return;
  }
  const period = input as unknown as ReportingPeriod;
  if (!periodBases.includes(String(period.basis))) add("period.basis", "INVALID_PERIOD_BASIS", "Reporting-period basis is unsupported.");
  const end = parseIsoDate(period.end);
  if (!end) add("period.end", "INVALID_DATE", "Reporting-period end must be a valid ISO calendar date.");
  if (category === "balance-sheet") {
    if (period.basis !== "instant" || period.start !== null) add("period", "INVALID_INSTANT_PERIOD", "Balance-sheet observations must be instantaneous with no start date.");
    if (period.durationDays !== null || period.durationWeeks !== null) add("period.duration", "INVALID_INSTANT_DURATION", "Instantaneous observations cannot have a duration.");
  } else if (period.basis === "instant") {
    add("period.basis", "INVALID_FLOW_PERIOD", "Income and cash-flow observations cannot be instantaneous.");
  }
  if (period.basis !== "instant") {
    const start = parseIsoDate(period.start);
    if (!start) add("period.start", "INVALID_DATE", "Flow-period start must be a valid ISO calendar date.");
    else if (end && start.getTime() > end.getTime()) add("period", "REVERSED_PERIOD", "Reporting-period start must not follow its end.");
    if (start && end) {
      const dateDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
      if (period.durationDays !== dateDays) add("period.durationDays", "DURATION_MISMATCH", "Declared duration does not match the inclusive start and end dates.");
      if (period.durationWeeks !== null && period.durationWeeks !== dateDays / 7) add("period.durationWeeks", "DURATION_MISMATCH", "Declared week duration does not match the date-derived duration.");
    }
  }
  if (period.durationDays !== null && (!Number.isInteger(period.durationDays) || period.durationDays <= 0)) add("period.durationDays", "INVALID_DURATION", "Duration days must be a positive integer.");
  if (period.durationWeeks !== null && (!Number.isFinite(period.durationWeeks) || period.durationWeeks <= 0)) add("period.durationWeeks", "INVALID_DURATION", "Duration weeks must be positive.");
  if (period.fiscalYearStart !== null && period.fiscalYearStart !== undefined && !parseIsoDate(period.fiscalYearStart)) {
    add("period.fiscalYearStart", "INVALID_DATE", "Fiscal-year start must be a valid ISO calendar date.");
  }
  if (period.fiscalYearEnd !== null && period.fiscalYearEnd !== undefined && !parseIsoDate(period.fiscalYearEnd)) {
    add("period.fiscalYearEnd", "INVALID_DATE", "Fiscal-year end must be a valid ISO calendar date.");
  }
  if (!["source-verified", "unverified"].includes(String(period.fiscalYearBoundaryStatus))) {
    add("period.fiscalYearBoundaryStatus", "INVALID_FISCAL_BOUNDARY_STATUS", "Fiscal-year boundary status is unsupported.");
  }

  if (period.basis === "year-to-date" || period.basis === "discrete-quarter") {
    if (!isNonEmptyString(period.fiscalYearId) || !isNonEmptyString(period.fiscalCalendarId)
        || !isNonEmptyString(period.fiscalQuarterId) || !Number.isInteger(period.fiscalQuarterNumber)
        || period.fiscalQuarterNumber! < 1 || period.fiscalQuarterNumber! > 4) {
      add("period.fiscalMetadata", "INCOMPLETE_FISCAL_METADATA", "Fiscal year, calendar and quarter metadata are required and must be valid.");
    }
    const yearStart = parseIsoDate(period.fiscalYearStart);
    const quarterStart = parseIsoDate(period.fiscalQuarterStart);
    const quarterEnd = parseIsoDate(period.fiscalQuarterEnd);
    if (!yearStart) add("period.fiscalYearStart", "INVALID_DATE", "Fiscal-year start must be a valid ISO calendar date.");
    if (!quarterStart) add("period.fiscalQuarterStart", "INVALID_DATE", "Fiscal-quarter start must be a valid ISO calendar date.");
    if (!quarterEnd) add("period.fiscalQuarterEnd", "INVALID_DATE", "Fiscal-quarter end must be a valid ISO calendar date.");
    if (yearStart && quarterStart && quarterStart.getTime() < yearStart.getTime()) add("period.fiscalQuarterStart", "INCONSISTENT_FISCAL_PERIOD", "Fiscal quarter cannot start before its fiscal year.");
    if (quarterStart && quarterEnd && quarterStart.getTime() > quarterEnd.getTime()) add("period.fiscalQuarter", "REVERSED_PERIOD", "Fiscal-quarter start must not follow its end.");
    if (period.basis === "year-to-date") {
      if (period.start !== period.fiscalYearStart) add("period.start", "INCONSISTENT_FISCAL_PERIOD", "YTD period must start at fiscal-year start.");
      if (period.end !== period.fiscalQuarterEnd) add("period.end", "INCONSISTENT_FISCAL_PERIOD", "YTD end must match its reported fiscal-quarter end.");
    }
    if (period.basis === "discrete-quarter" && (period.start !== period.fiscalQuarterStart || period.end !== period.fiscalQuarterEnd)) {
      add("period", "INCONSISTENT_FISCAL_PERIOD", "Discrete quarter dates must match the fiscal-quarter dates.");
    }
  }
  if (!["complete", "incomplete", "unknown"].includes(String(period.completeness))) add("period.completeness", "INVALID_COMPLETENESS", "Period completeness status is unsupported.");
  void observationId;
}

function validateProvenance(
  input: unknown,
  observationId: string | null,
  add: (path: string, code: string, message: string) => void,
  allowDerived: boolean
): void {
  const path = "source";
  if (!isRecord(input)) {
    add(path, "INVALID_PROVENANCE", "Source provenance must be an object.");
    return;
  }
  for (const field of ["providerId", "providerName", "dataset", "market", "sourceRecordId"] as const) {
    if (!isNonEmptyString(input[field])) add(`${path}.${field}`, "MISSING_PROVENANCE", "Required source identifier is missing.");
  }
  if (!isTimestamp(input.retrievedAt)) add(`${path}.retrievedAt`, "INVALID_TIMESTAMP", "Source retrieval timestamp is invalid.");
  if (input.asOf !== null && input.asOf !== undefined && !isTimestamp(input.asOf)) add(`${path}.asOf`, "INVALID_TIMESTAMP", "Source as-of timestamp is invalid.");
  if (!environments.includes(input.dataEnvironment as DataEnvironment)) add(`${path}.dataEnvironment`, "INVALID_ENVIRONMENT", "Source data environment is missing or unsupported.");
  if (!isRecord(input.revision) || !revisionStatuses.includes(String(input.revision.status))) add(`${path}.revision`, "INVALID_REVISION", "Source revision metadata is missing or invalid.");
  if (!Array.isArray(input.entitlements) || !Array.isArray(input.entitlementIds)) {
    add(`${path}.entitlements`, "INVALID_ENTITLEMENTS", "Source entitlement records and identifiers are required.");
  } else {
    const rawRecords = input.entitlements as unknown[];
    const ids = input.entitlementIds as unknown[];
    if (ids.some((id) => typeof id !== "string" || !id.trim()) || rawRecords.some((record) => !isRecord(record) || !isNonEmptyString(record.id))) {
      add(`${path}.entitlements`, "INVALID_ENTITLEMENTS", "Entitlement records and identifiers must be complete.");
    } else {
      const records = rawRecords as DataEntitlement[];
      const recordIds = records.map((record) => record.id);
      if (new Set(ids).size !== ids.length || new Set(recordIds).size !== recordIds.length
          || ids.length !== recordIds.length || ids.some((id) => !recordIds.includes(id as string))) {
        add(`${path}.entitlementIds`, "ENTITLEMENT_LINEAGE_MISMATCH", "Entitlement identifiers must exactly match attached entitlement records.");
      }
      if (!allowDerived || input.providerId !== "aynox-derived") {
        if (records.some((record) => record.providerId !== input.providerId || record.dataset !== input.dataset || record.market !== input.market)) {
          add(`${path}.entitlements`, "ENTITLEMENT_SCOPE_MISMATCH", "Source entitlements do not match the source provider, dataset and market.");
        }
      }
      if (environments.includes(input.dataEnvironment as DataEnvironment)
          && records.some((record) => record.dataEnvironment !== input.dataEnvironment)) {
        add(`${path}.entitlements`, "SOURCE_ENTITLEMENT_ENVIRONMENT_MISMATCH", "Source provenance and entitlement data environments must agree.");
      }
      for (const [index, record] of records.entries()) validateEntitlement(record, `${path}.entitlements[${index}]`, add);
    }
  }
  if (allowDerived && input.providerId === "aynox-derived") {
    if (!Array.isArray(input.upstreamObservationIds) || input.upstreamObservationIds.length !== 2
        || !Array.isArray(input.upstreamSources) || input.upstreamSources.length !== 2) {
      add(`${path}.upstreamSources`, "INCOMPLETE_DERIVATION_LINEAGE", "Derived values must preserve both upstream observation IDs and source records.");
    } else {
      const upstreamIds = input.upstreamSources.map((source) => isRecord(source) ? source.observationId : null);
      if (input.upstreamObservationIds.some((id) => !upstreamIds.includes(id))) add(`${path}.upstreamSources`, "INCOMPLETE_DERIVATION_LINEAGE", "Upstream source records must match the upstream observation IDs.");
      for (const [index, source] of input.upstreamSources.entries()) validateUpstreamSource(source, `${path}.upstreamSources[${index}]`, add);
    }
  }
  void observationId;
}

function validateUpstreamSource(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, "INVALID_UPSTREAM_SOURCE", "Upstream source record must be an object.");
    return;
  }
  for (const field of ["observationId", "providerId", "providerName", "dataset", "market", "sourceRecordId"] as const) {
    if (!isNonEmptyString(input[field])) add(`${path}.${field}`, "MISSING_UPSTREAM_SOURCE", "Upstream source identifier is missing.");
  }
  if (!isTimestamp(input.retrievedAt)) add(`${path}.retrievedAt`, "INVALID_TIMESTAMP", "Upstream retrieval timestamp is invalid.");
  if (!Array.isArray(input.entitlements) || !Array.isArray(input.entitlementIds)) add(`${path}.entitlements`, "INVALID_ENTITLEMENTS", "Upstream entitlement records and identifiers are required.");
  else {
    const records = input.entitlements as unknown[];
    const recordIds = records.filter(isRecord).map((record) => record.id);
    if (recordIds.length !== records.length || input.entitlementIds.length !== recordIds.length
        || input.entitlementIds.some((id) => !recordIds.includes(id))) {
      add(`${path}.entitlementIds`, "ENTITLEMENT_LINEAGE_MISMATCH", "Upstream entitlement identifiers must match attached records.");
    }
  }
}

function validateEntitlement(input: unknown, path: string, add: (path: string, code: string, message: string) => void): void {
  if (!isRecord(input)) {
    add(path, "INVALID_ENTITLEMENT", "Entitlement record must be an object.");
    return;
  }
  for (const field of ["id", "providerId", "dataset", "market", "contractRef", "contractVersion"] as const) {
    if (!isNonEmptyString(input[field])) add(`${path}.${field}`, "INVALID_ENTITLEMENT", "Entitlement scope identifier is missing.");
  }
  if (!environments.includes(input.dataEnvironment as DataEnvironment)) add(`${path}.dataEnvironment`, "INVALID_ENTITLEMENT_ENVIRONMENT", "Entitlement data environment must be explicit and supported.");
  if (!Array.isArray(input.authorizedEnvironments) || input.authorizedEnvironments.length === 0
      || input.authorizedEnvironments.some((environment) => !environments.includes(environment))) add(`${path}.authorizedEnvironments`, "INVALID_ENTITLEMENT_ENVIRONMENT", "Entitlement environments must be explicit and supported.");
  if (!audiences.includes(String(input.permittedAudience))) add(`${path}.permittedAudience`, "INVALID_ENTITLEMENT_AUDIENCE", "Entitlement audience must be explicit and supported.");
  if (!isTimestamp(input.effectiveFrom) || (input.effectiveTo !== undefined && !isTimestamp(input.effectiveTo))) add(`${path}.effectiveDates`, "INVALID_ENTITLEMENT_DATES", "Entitlement effective dates must be valid.");
  else if (input.effectiveTo !== undefined && Date.parse(input.effectiveTo) <= Date.parse(input.effectiveFrom)) add(`${path}.effectiveDates`, "INVALID_ENTITLEMENT_DATES", "Entitlement expiry must follow its effective date.");
  if (input.permittedAudience === "demo-only" && (input.dataEnvironment !== "synthetic" || !Array.isArray(input.authorizedEnvironments) || input.authorizedEnvironments.some((environment) => environment !== "synthetic"))) {
    add(`${path}.authorizedEnvironments`, "DEMO_ENTITLEMENT_ENVIRONMENT_MISMATCH", "Demo-only entitlements may authorize only synthetic data environments.");
  }
  if (input.permittedAudience === "internal" && input.dataEnvironment !== "development-restricted") {
    add(`${path}.dataEnvironment`, "INTERNAL_ENTITLEMENT_ENVIRONMENT_MISMATCH", "Internal testing entitlements must identify a development-restricted data environment.");
  }
  if ((input.permittedAudience === "named-customer" || input.permittedAudience === "public") && input.dataEnvironment !== "production-licensed") {
    add(`${path}.dataEnvironment`, "CUSTOMER_ENTITLEMENT_ENVIRONMENT_MISMATCH", "Customer-facing entitlements must identify explicitly production-licensed data.");
  }
  if (!isRecord(input.permissions)) add(`${path}.permissions`, "INVALID_ENTITLEMENT_PERMISSIONS", "Operation permissions must be explicit.");
  else for (const [operation, permission] of Object.entries(input.permissions)) {
    if (!isRecord(permission) || !permissionStates.includes(String(permission.state))) add(`${path}.permissions.${operation}`, "INVALID_ENTITLEMENT_PERMISSION", "Operation permission state is unsupported.");
  }
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
