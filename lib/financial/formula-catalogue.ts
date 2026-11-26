import type { FinancialMetricId, FinancialUnit, ReportingPeriodBasis } from "@/types/financial";

export type FormulaImplementationStatus = "implemented-provisional" | "blocked-open-definition";

export interface FinancialFormulaDefinition {
  metricId: FinancialMetricId;
  displayName: string;
  formulaIdentifier: string;
  formulaVersion: string;
  formulaDescription: string;
  requiredMetricKeys: string[];
  requiredUnits: FinancialUnit[];
  allowedPeriodBases: ReportingPeriodBasis[];
  currencyRule: string;
  rounding: {
    mode: "half-up-away-from-zero" | "none";
    calculationDecimalPlaces: number | null;
    displayDecimalPlaces: number;
  };
  implementationStatus: FormulaImplementationStatus;
  unsupportedConditions: string[];
}

/** D-34 remains open; these are proposed deterministic v1 formulas, not approved customer claims. */
export const financialFormulaCatalogue = [
  {
    metricId: "revenue-growth", displayName: "Revenue growth", formulaIdentifier: "revenue-growth", formulaVersion: "v1",
    formulaDescription: "(current comparable-period revenue - prior comparable-period revenue) / prior comparable-period revenue × 100",
    requiredMetricKeys: ["revenue", "revenue"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual"], currencyRule: "Same reporting currency and scale; no conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 },
    implementationStatus: "implemented-provisional", unsupportedConditions: ["Comparison period is not the immediately preceding fiscal year equivalent", "Prior revenue is negative", "Current revenue is negative", "Currency or scale differs"]
  },
  {
    metricId: "gross-margin", displayName: "Gross margin", formulaIdentifier: "gross-margin", formulaVersion: "v1",
    formulaDescription: "source-reported gross profit / revenue × 100; deriving gross profit from cost of revenue is future work and requires approved, verified input semantics",
    requiredMetricKeys: ["gross-profit", "revenue"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 },
    implementationStatus: "implemented-provisional", unsupportedConditions: ["Gross-profit source mapping is not semantically verified", "Revenue is zero or negative", "Currency, scale, period or scope differs"]
  },
  {
    metricId: "operating-margin", displayName: "Operating margin", formulaIdentifier: "operating-margin", formulaVersion: "v1",
    formulaDescription: "operating income / revenue × 100",
    requiredMetricKeys: ["operating-income", "revenue"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 },
    implementationStatus: "implemented-provisional", unsupportedConditions: ["Revenue is zero or negative", "Currency, scale, period or scope differs"]
  },
  {
    metricId: "net-margin", displayName: "Net margin", formulaIdentifier: "net-margin", formulaVersion: "v1",
    formulaDescription: "net income / revenue × 100; net-income attribution definition remains unresolved",
    requiredMetricKeys: ["net-income", "revenue"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 },
    implementationStatus: "blocked-open-definition", unsupportedConditions: ["D-34 has not approved consolidated versus attributable net-income definition"]
  },
  {
    metricId: "operating-cash-flow", displayName: "Operating cash flow", formulaIdentifier: "operating-cash-flow", formulaVersion: "v1",
    formulaDescription: "source-reported net cash from operating activities; no arithmetic derivation",
    requiredMetricKeys: ["operating-cash-flow"], requiredUnits: ["currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Preserve source currency and scale; no conversion.",
    rounding: { mode: "none", calculationDecimalPlaces: null, displayDecimalPlaces: 2 },
    implementationStatus: "implemented-provisional", unsupportedConditions: ["Source field is absent or unmapped"]
  },
  {
    metricId: "free-cash-flow", displayName: "Free cash flow", formulaIdentifier: "free-cash-flow", formulaVersion: "v1",
    formulaDescription: "operating cash flow - capital expenditure cash-use magnitude",
    requiredMetricKeys: ["operating-cash-flow", "capital-expenditure"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.",
    rounding: { mode: "none", calculationDecimalPlaces: null, displayDecimalPlaces: 2 },
    implementationStatus: "blocked-open-definition", unsupportedConditions: ["D-34 has not approved capex field semantics and sign normalization"]
  },
  {
    metricId: "current-ratio", displayName: "Current ratio", formulaIdentifier: "current-ratio", formulaVersion: "v1",
    formulaDescription: "current assets / current liabilities",
    requiredMetricKeys: ["current-assets", "current-liabilities"], requiredUnits: ["currency", "currency"],
    allowedPeriodBases: ["instant"], currencyRule: "Same currency and scale; they cancel. No conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 },
    implementationStatus: "implemented-provisional", unsupportedConditions: ["Statement dates or scopes differ", "Current liabilities are zero or negative", "Current assets are negative"]
  },
  {
    metricId: "debt-to-equity", displayName: "Debt-to-equity", formulaIdentifier: "debt-to-equity", formulaVersion: "v1",
    formulaDescription: "(short-term interest-bearing debt + long-term interest-bearing debt) / total shareholders’ equity",
    requiredMetricKeys: ["short-term-interest-bearing-debt", "long-term-interest-bearing-debt", "total-shareholders-equity"],
    requiredUnits: ["currency", "currency", "currency"], allowedPeriodBases: ["instant"],
    currencyRule: "Same currency and scale; they cancel. No conversion.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 },
    implementationStatus: "blocked-open-definition", unsupportedConditions: ["Debt categories, double-counting, lease treatment and equity scope remain unapproved"]
  },
  {
    metricId: "price-to-earnings", displayName: "Price-to-earnings", formulaIdentifier: "price-to-earnings", formulaVersion: "v1",
    formulaDescription: "equity market capitalization / aligned trailing net income attributable to matching equity holders",
    requiredMetricKeys: ["equity-market-capitalization", "trailing-net-income-attributable"],
    requiredUnits: ["currency", "currency"], allowedPeriodBases: ["instant", "trailing-twelve-month"],
    currencyRule: "Same currency and compatible scale; no implicit FX.",
    rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 },
    implementationStatus: "blocked-open-definition", unsupportedConditions: ["Market-cap method, share class, earnings attribution, TTM alignment and price freshness remain unapproved"]
  }
] as const satisfies readonly FinancialFormulaDefinition[];

export function getFinancialFormula(metricId: FinancialMetricId): FinancialFormulaDefinition {
  const definition = financialFormulaCatalogue.find((item) => item.metricId === metricId);
  if (!definition) throw new TypeError("Unknown financial metric identifier.");
  return definition;
}

type ImplementationContract = Pick<FinancialFormulaDefinition,
  "formulaIdentifier" | "formulaVersion" | "requiredMetricKeys" | "requiredUnits" | "allowedPeriodBases" | "currencyRule" | "rounding" | "implementationStatus">;

/** Locked v1 implementation manifest. Formula metadata changes must update this contract and matching tests. */
const formulaImplementationRegistry: Record<FinancialMetricId, ImplementationContract> = {
  "revenue-growth": { formulaIdentifier: "revenue-growth", formulaVersion: "v1", requiredMetricKeys: ["revenue", "revenue"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual"], currencyRule: "Same reporting currency and scale; no conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 }, implementationStatus: "implemented-provisional" },
  "gross-margin": { formulaIdentifier: "gross-margin", formulaVersion: "v1", requiredMetricKeys: ["gross-profit", "revenue"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 }, implementationStatus: "implemented-provisional" },
  "operating-margin": { formulaIdentifier: "operating-margin", formulaVersion: "v1", requiredMetricKeys: ["operating-income", "revenue"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 }, implementationStatus: "implemented-provisional" },
  "net-margin": { formulaIdentifier: "net-margin", formulaVersion: "v1", requiredMetricKeys: ["net-income", "revenue"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 1, displayDecimalPlaces: 1 }, implementationStatus: "blocked-open-definition" },
  "operating-cash-flow": { formulaIdentifier: "operating-cash-flow", formulaVersion: "v1", requiredMetricKeys: ["operating-cash-flow"], requiredUnits: ["currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Preserve source currency and scale; no conversion.", rounding: { mode: "none", calculationDecimalPlaces: null, displayDecimalPlaces: 2 }, implementationStatus: "implemented-provisional" },
  "free-cash-flow": { formulaIdentifier: "free-cash-flow", formulaVersion: "v1", requiredMetricKeys: ["operating-cash-flow", "capital-expenditure"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["discrete-quarter", "year-to-date", "annual", "trailing-twelve-month"], currencyRule: "Same reporting currency and scale; no conversion.", rounding: { mode: "none", calculationDecimalPlaces: null, displayDecimalPlaces: 2 }, implementationStatus: "blocked-open-definition" },
  "current-ratio": { formulaIdentifier: "current-ratio", formulaVersion: "v1", requiredMetricKeys: ["current-assets", "current-liabilities"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["instant"], currencyRule: "Same currency and scale; they cancel. No conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 }, implementationStatus: "implemented-provisional" },
  "debt-to-equity": { formulaIdentifier: "debt-to-equity", formulaVersion: "v1", requiredMetricKeys: ["short-term-interest-bearing-debt", "long-term-interest-bearing-debt", "total-shareholders-equity"], requiredUnits: ["currency", "currency", "currency"], allowedPeriodBases: ["instant"], currencyRule: "Same currency and scale; they cancel. No conversion.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 }, implementationStatus: "blocked-open-definition" },
  "price-to-earnings": { formulaIdentifier: "price-to-earnings", formulaVersion: "v1", requiredMetricKeys: ["equity-market-capitalization", "trailing-net-income-attributable"], requiredUnits: ["currency", "currency"], allowedPeriodBases: ["instant", "trailing-twelve-month"], currencyRule: "Same currency and compatible scale; no implicit FX.", rounding: { mode: "half-up-away-from-zero", calculationDecimalPlaces: 2, displayDecimalPlaces: 2 }, implementationStatus: "blocked-open-definition" }
};

export function isFormulaDefinitionSupported(definition: FinancialFormulaDefinition): boolean {
  const contract = formulaImplementationRegistry[definition.metricId];
  return Boolean(contract
    && contract.formulaIdentifier === definition.formulaIdentifier
    && contract.formulaVersion === definition.formulaVersion
    && contract.implementationStatus === definition.implementationStatus
    && contract.currencyRule === definition.currencyRule
    && contract.rounding.mode === definition.rounding.mode
    && contract.rounding.calculationDecimalPlaces === definition.rounding.calculationDecimalPlaces
    && contract.rounding.displayDecimalPlaces === definition.rounding.displayDecimalPlaces
    && contract.requiredMetricKeys.join("|") === definition.requiredMetricKeys.join("|")
    && contract.requiredUnits.join("|") === definition.requiredUnits.join("|")
    && contract.allowedPeriodBases.join("|") === definition.allowedPeriodBases.join("|"));
}
