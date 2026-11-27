# Aynox Milestone 4 Technical Design

**Milestone:** 4 — AI-powered investment research  
**Version:** 0.1  
**Status:** Design proposed; Steps 3.2 and 3.3.3.1 provide a non-publishing server-side scaffold; provider/right feasibility and founder approvals remain pending
**Prepared:** 26 November 2026  
**Scope:** Milestone 4 design baseline; the Step 3.2 provider abstraction foundation and Step 3.3.3.1 verified-entitlement evidence boundary are implemented as described below. No concrete provider, report-generation operation, or publication path is connected.
**Companion:** [Milestone 4 PRD](aynox-milestone-4-prd.md)

## Step 3.2 implemented foundation

The following foundation is implemented without connecting a live provider:

- ResearchGenerationProvider defines a provider/model-neutral port that accepts only a projected, permission-cleared facts DTO and returns untrusted output. Request context, signed entitlement records, receipts, and operation decisions remain server-side.
- StructuredResearchReportDraft separates model-selected `factReferences` from free-form `interpretations`. The model cannot provide values for verified financial facts, citation URLs, publication status, or other server-owned fields.
- `validateStructuredResearchReport` performs bounded structural schema validation, snapshot/evidence-reference validation, identity/period/unit/currency/formula/lineage checks, and deterministic resolution of numeric facts. Schema validity does not prove semantic correctness: every free-form passage remains explicitly classified as an unverified AI interpretation, regardless of its context references.
- `renderVerifiedResearchFacts` re-resolves facts against the same immutable snapshot and content digest, then formats server-owned values, units, currencies, scales, and periods. It rejects snapshot or evidence mismatches. Model-authored numeric text is never rendered in the verified-facts channel.
- Interpretation support is not automatically proven. Unsupported or contradictory prose must remain unverified and is not eligible for publication based on structural or reference validation alone.
- Server configuration reads AYNOX_AI_PROVIDER, AYNOX_AI_MODEL, AYNOX_AI_API_KEY, AYNOX_AI_TIMEOUT_MS, and AYNOX_AI_MAX_RETRIES. Provider, model, and credential have no defaults. The config module guards against browser execution. .env.example includes only blank credential/provider/model values.
- The adapter registry requires an explicit provider registration and model-ID allowlist before adapter creation; an adapter echoing its configured model ID is not evidence that the model is supported. No concrete adapter is registered by this step.
- Sensitive configuration and verified-fact rendering import Next.js's `server-only` marker. Next.js production compilation fails if these modules enter a Client Component graph; configuration errors and provider errors do not serialize credentials or raw provider payloads.
- Provider errors use fixed safe application categories. The execution helper propagates caller cancellation and per-attempt abort signals, bounds retry count and delay, retries only explicit rate-limit and selected transient-unavailable categories, and never retries an internal timeout/cancellation while the prior operation may remain active. An adapter that ignores cancellation can leave its remote operation running; the helper fails and does not start a duplicate attempt.
- Deterministic tests exercise structural validation, evidence binding/rendering, provider/model allowlists, error sanitization, cancellation, timeout, retry bounds, deep/oversized payloads, and server-only boundaries.

### Validation layers and publication gate

1. **Structural schema validation** checks JSON shape, exact keys, bounds, enums, section membership, and array limits. Passing this layer says only that output follows the contract.
2. **Evidence-reference validation** binds the draft to a snapshot ID and SHA-256 content digest; resolves every reference; and rejects cross-security nested identities, incompatible periods, mismatched metrics, units, currency, calculation formulas, or input lineage.
3. **Deterministic financial fact rendering** obtains values and descriptive context from authoritative server evidence. Model-authored values cannot enter this verified channel. The rendered output is re-bound to and rechecked against the same snapshot.
4. **Semantic interpretation assessment** is not proven by schema validation or by the presence of relevant evidence IDs. Interpretation text is labeled unverified; human review or a separately evaluated semantic process would be needed before asserting support.
5. **Report publication eligibility** remains disabled in Step 3.2 (`not_eligible_step_3_2`). No reports are generated or published to customers in this foundation.

## Step 3.3.3.1 verified-entitlement evidence boundary

- Evidence assembly requires a genuine server-issued request context authorized for the exact security. The snapshot binds all context fields with a server-computed digest; AI validation, generation-input projection, and deterministic rendering revalidate the context binding.
- Research evidence uses signed technical entitlement records verified through the existing verifier and exact provider/dataset/market/security/source/contract scope. Caller-supplied legacy consumer or structural entitlement claims are ignored for research authorization.
- Permission assessments and signed verification receipts are snapshot authorization metadata, separate from factual source provenance. Evidence items reference assessments by ID; the AI projection includes neither receipts nor operation decisions nor nested entitlement records.
- The current production trust-root registry is empty and the production authorization adapter remains unavailable. Production evidence therefore cannot be assembled. Controlled synthetic evidence is permitted only in the explicitly test-only internal-demo policy; test signing and trust-root modules are Vitest-only and excluded from runtime imports.
- Each operation remains independent. Retrieval plus AI processing is required for raw facts; financial metric evidence additionally requires derivation on every input; news sentiment and summaries require derivation on each source. This scaffold does not imply storage, retention, display, redistribution, or legal approval.
- Legal/contractual status remains `pending`; technical signature verification is not legal approval. Publication eligibility remains disabled. No AI service is called and no report is generated or persisted.

## Step 3.3.3.3 evidence operation enforcement corrections

- Fundamentals retrieval now requires a server-side adapter preflight before either profile or statement fetch method is called. The preflight binds the trusted provider ID, configured dataset, canonical market/security, contract ID/version and a signed retrieval entitlement. Missing, invalid, expired, ambiguous or mismatched authorization fails closed. The current synthetic fixture uses a dataset/security scoped (`sourceRecordId: null`) retrieval declaration because source-record IDs are only returned with the fixture data; exact source-record entitlements are still checked independently after retrieval. This test-only dataset-scope pattern does not enable any production retrieval. A future provider must supply this authorization independently of protected response data and use a contract-approved scope granularity; production preflight remains unavailable until production auth and trust roots exist.
- The response's provider payload is validated separately after retrieval. A valid entitlement proves only signed declared scope/operation permissions; it does not cryptographically authenticate the financial or news content. A future adapter must establish content provenance and integrity independently. Request-supplied news/ESG/provider metadata cannot be treated as a production trust source; there is no production content-trust integration, and production evidence remains denied.
- Deterministic rendering revalidates current signed receipts and requires `display` permission for every cited source. Calculated facts additionally require display permission from every source observation in their complete calculation lineage. Display permission is independent of retrieval, derivation and AI-processing permissions. If any source denies display, the complete fact is rejected.
- AI generation input is bounded before the final DTO is returned: at most 1,000 evidence items, 40,000 serialized characters per item, 200,000 serialized characters total, 1,000 JSON nodes per item, nesting depth 32, and 40,000 characters for any individual string. Inputs over these deterministic limits are rejected without truncating values or references.
- Synthetic positive preflight behavior exists only through the Vitest fixture issuer/trust-root mapping. Production trust roots remain empty, production authorization remains unavailable, legal approval remains pending, and report publication remains disabled. No live providers, AI service, persistence or customer-facing report path is enabled by this correction.
- Research evidence assembly verifies a separate signed news retrieval preflight before invoking an injected news loader. The preflight is fixed to the synthetic news dataset, dataset-level contract scope, and test trust root; missing, expired, malformed, or mismatched preflight does not invoke the loader. Provider registration has no setter, and the general UI news service reads fixed in-memory synthetic fixtures directly rather than invoking a provider. Research fallback to those fixtures and injected demo fixtures are allowed only under the explicit Vitest synthetic-evidence policy. Non-demo article content is excluded because an entitlement does not authenticate article content. No external provider can currently be selected or retrieved; production trust roots and production authorization remain unavailable.
- Generation-input structural limits are enforced with a bounded iterative worklist: arrays are checked against remaining node capacity before enqueueing, and object properties are traversed without materializing an unbounded values array. Non-finite numbers and non-JSON object/value types are rejected. The character and depth limits remain as stated above.

This step does not call an AI service, generate reports, persist report records, add Prisma models, or establish semantic correctness from schema compliance. D-31 remains open and no provider/model is selected. Other Milestone 4 work remains proposed.

## 1. Executive architecture recommendation

Extend the existing Next.js/TypeScript modular monolith with two replaceable server-side contracts: a fundamentals provider and a structured research-generation provider. Build the normalization, calculations, evidence snapshot, validation, and report API inside Aynox. Keep provider payloads out of React components and do not let the language model fetch data, calculate financial ratios, invent citations, or act as a chatbot.

Recommended sequence:

1. Build and test normalized types against synthetic/mock fundamentals and immutable evidence fixtures.
2. Implement deterministic metrics and report validation without an external AI/data credential.
3. Benchmark AI provider candidates only on synthetic/rights-cleared fixtures.
4. At the approved feasibility stage, run the deferred provider proof of concept using explicitly authorized development data. Do not expose restricted development data to production customers.
5. Make no production provider/model choice until coverage, exact field semantics, commercial/display/derived-data rights, AI processing terms, quality, and operating cost are approved.

**Initial AI recommendation:** use OpenAI’s API as the first structured-output benchmark adapter, with a low-cost text model selected from current offerings after Aynox-specific evaluation. OpenAI documents schema-constrained outputs, including TypeScript/Zod helpers, and API data-use controls. This is a recommendation for a benchmark candidate, not a confirmed vendor/model selection. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [model catalog/pricing](https://developers.openai.com/api/docs/pricing), [API data controls](https://developers.openai.com/api/docs/guides/your-data).

**Initial fundamentals recommendation:** retain Finnhub as the first fundamentals feasibility candidate when that work is approved, while keeping Twelve Data as an active comparison. Finnhub publicly describes global fundamentals, standardized annual/quarterly statements with 30+ years, financials as reported, and an Enterprise commercial-use/redistribution license; terms and eligibility still require a written quote and field-level confirmation. This does not resolve the existing D-05 final market-data-provider decision or authorize the deferred six-market proof of concept. [Finnhub startup/enterprise plan](https://api.finnhub.io/pricing-startups-and-enterprise).

## 2. Current architecture and integration points

### Verified current state

- Next.js App Router + TypeScript + Tailwind, structured as a modular monolith.
- `lib/providers/market-data.ts` defines `MarketDataProvider` for listing/resolving securities, historical price series, and company news. `lib/providers/index.ts` lazily constructs `MockMarketDataProvider`.
- `lib/data/demo-data.ts` supplies synthetic securities, series, and ESG previews. Current research/detail UI directly selects these examples and labels them synthetic.
- News uses a separate `NewsProvider`, service, sentiment, query, deduplication, and report modules. `CompanyNewsWorkspace` already renders article-level/company-level report functionality.
- `types/market.ts` has a `Security` with mock-like `marketCap`/`peRatio`; `types/news.ts` contains article provenance and a `CompanyNewsReport` but no comprehensive financial report model.
- Prisma currently persists users, securities, tracked portfolios/membership intervals, and market observations. It does not persist fundamental statements, evidence snapshots, or research reports.
- The Research page and company detail view currently put synthetic overview/fundamentals/ESG beside the existing News workspace and a forecast placeholder. The design must replace or qualify these placeholders over time and reuse the current news path, not create a second news intelligence area.

### Proposed placement

Keep domain/provider services under `lib/`; add `lib/fundamentals`, `lib/research`, and adapters under `lib/providers` or a clearly separated `lib/integrations`. Server-only orchestration should be called from an authorized app route/server action. A future API route could be `app/api/research/[securityId]/report/route.ts`; this is a design illustration, not an instruction to create it now. Components receive validated, display-ready report DTOs and do not instantiate SDK clients.

Prefer a canonical company research view (the existing `/discover/[symbol]` company detail is a natural anchor) with a research-report section and a direct link into the existing news report. The `/research` workspace can support security selection/overview but should not create a competing report for the same security.

## 3. Provider-neutral data architecture

### Provider contracts

Keep responsibilities separate:

```ts
interface FundamentalsProvider {
  readonly providerName: string;
  getCompanyProfile(security: SecurityIdentity): Promise<ProviderResult<CompanyProfileRecord>>;
  getStatements(security: SecurityIdentity, request: StatementRequest): Promise<ProviderResult<FinancialStatementSet>>;
  getKeyMetrics?(security: SecurityIdentity, request: PeriodRequest): Promise<ProviderResult<ReportedMetricSet>>;
}

interface ResearchGenerationProvider {
  readonly providerName: string;
  readonly modelId: string;
  generateStructuredReport(input: ResearchGenerationInput): Promise<unknown>;
}
```

`ProviderResult<T>` should include `ok | partial | unavailable | error`, provider, request/retrieval time, coverage metadata, entitlement/content-use metadata known to the adapter, and a typed payload/error. Market prices remain under the existing market provider contract; news remains under the news service/provider; fundamental statements should not be stuffed into page-specific market structures.

Security identity should carry `securityId`, canonical symbol, exchange/MIC when available, provider-specific symbol/id, and mapping status. Provider resolution must be explicit and audited. Never infer identity through exact company display-name string matching.

### Proposed domain records

These are conceptual TypeScript/domain contracts, not Prisma schema changes. Data environment and legal permissions are separate concepts: a dataset can be retrieved in development while still being forbidden from storage, display, derivation, AI processing, or redistribution.

```ts
type DataEnvironment = "synthetic" | "development-restricted" | "production-licensed";
type DataOperation = "retrieval" | "storage" | "display" | "derivation" | "ai-processing" | "retention" | "redistribution";
type PermissionState = "allowed" | "denied" | "conditional" | "unverified";

type PeriodBasis = "discrete-quarter" | "year-to-date" | "annual" | "trailing-twelve-month" | "instant";

interface DataEntitlement {
  id: string;
  provider: string;
  dataset: string;
  market?: string;                   // MIC/exchange or explicitly covered market group
  contractRef: string;               // internal record of exact terms/addendum
  contractVersion: string;
  effectiveFrom: string;
  effectiveTo?: string;
  permissions: Record<DataOperation, {
    state: PermissionState;
    conditions?: string[];           // e.g. attribution, paid tier, market add-on, non-real-time
  }>;
  permittedAudience?: "internal" | "named-customer" | "public";
  attribution?: string;
  retentionLimit?: string;
}

interface ReportingPeriod {
  basis: PeriodBasis;
  start: string | null;              // null for instant values
  end: string;                       // period end / balance-sheet instant
  fiscalYearId: string | null;       // provider/issuer identifier; not derived from calendar year
  fiscalYearStart: string | null;    // source-reported boundary
  fiscalYearEnd: string | null;      // source-reported boundary
  fiscalYearBoundaryStatus: "source-verified" | "unverified";
  fiscalQuarterId: string | null;
  fiscalCalendarId: string | null;
  sourcePeriodLabel: string;
  durationDays: number | null;
  durationWeeks: number | null;      // preserve 52/53-week periods when source reports them
}

interface FinancialObservation {
  id: string;
  securityId: string;
  metricKey: string;                 // Aynox normalized key
  providerMetricKey: string;         // source field, preserved
  value: string | null;              // decimal string; do not round on ingest
  currency: string | null;
  unit: string | null;
  scale: string | null;
  period: ReportingPeriod;
  accountingBasis: string | null;    // as-reported, standardized/GAAP/etc.
  consolidationScope: string | null;
  filingDate: string | null;
  asOf: string | null;
  source: { provider: string; dataset: string; market?: string; recordId?: string; url?: string };
  fetchedAt: string;
  revisionOf?: string;
  dataEnvironment: DataEnvironment;
  entitlementIds: string[];
}

interface ResearchEvidence {
  id: string;
  securityId: string;
  kind: "reported-fact" | "financial-observation" | "calculated-metric" | "news-report" | "news-article" | "verified-esg" | "approved-context";
  claimInput: string;                // bounded evidence/approved summary, not an unrestricted corpus
  sourceLabel: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  publishedAt?: string;
  reportingPeriod?: ReportingPeriod;
  asOf?: string;
  fetchedAt: string;
  dataEnvironment: DataEnvironment;
  entitlementIds: string[];          // operations are resolved against exact entitlement scope
  contentHash: string;
}

interface ClaimDraft {
  claimId: string;
  claimType: "reported_fact" | "numeric_fact" | "calculated_metric" | "interpretation";
  statement: string;
  securityId: string;
  metricIdentifier?: string;
  numericValue?: string;             // canonical decimal, not display-rounded prose
  numericUnit?: { kind: string; currency?: string; scale?: string };
  reportingPeriod?: ReportingPeriod;
  supportingObservationIds: string[];
  supportingCalculationIds: string[];
  evidenceIds: string[];
}

interface ValidatedClaim extends ClaimDraft {
  validationStatus: "validated" | "rejected" | "review_required"; // assigned only by server
  validationIssues: string[];
}

type GenerationStatus = "complete" | "partial" | "insufficient_evidence" | "failed";
type FreshnessStatus = "current" | "stale" | "mixed" | "unknown";
type RefreshAttemptStatus = "succeeded" | "failed" | "not-attempted";

interface ResearchReportState {
  generationStatus: GenerationStatus;
  freshnessStatus: FreshnessStatus;
  freshnessEvaluatedAt: string;
  lastRefreshAttempt: { status: RefreshAttemptStatus; attemptedAt?: string; failureCode?: string };
  sourceFreshness: Array<{ dataset: string; sourceAsOf?: string; status: FreshnessStatus; ruleVersion?: string }>;
}
```

Schema invariants depend on `claimType`: a `numeric_fact` requires a canonical numeric value, unit, reporting period when applicable, and supporting observation/evidence IDs; a `calculated_metric` requires metric identifier, canonical value/unit/period, calculation ID, and its full observation lineage; a nonnumeric `reported_fact` requires source evidence and the canonical security ID; an `interpretation` requires supporting IDs and cannot assert a separate unstructured financial number. Server validation status is never accepted from the model. `validated` claims may be published; `rejected` and `review_required` claims are withheld until resolved.`ClaimDraft` is model output; `ValidatedClaim` and all status fields are server-owned. Numeric facts and calculated metrics are rendered from the validated observation/calculation record, not from arbitrary model-written number strings. For factual numeric claims, the server can use a fixed label/template plus the exact validated value/period. Interpretive prose may reference evidence, but it cannot override the structured facts or values.

The persisted report references immutable evidence and stores canonical `securityId`, generation time, completeness status, separately evaluated freshness, refresh-attempt state, provider/model/prompt/schema/formula versions, evidence/input hashes, and validation results. The server resolves IDs to authorized source metadata at render time; model-produced citations/URLs are not authoritative.

Use decimal-safe arithmetic for financial values; preserve exact source decimals and round only for display under a versioned rule. Raw provider payload retention is always conditional on the exact entitlement for storage and retention.

The initial decimal utility accepts at most 146 input characters, 120 integer digits, and 24 fractional digits; division and quantization precision is capped at 24 decimal places. These conservative bounds are far above ordinary company financial values while bounding `BigInt` and power-of-ten work. Inputs outside the limits are rejected with a structured validation reason or typed arithmetic error; values are never truncated. Percentage calculations preserve the exact decimal ratio until a guarded, formula-declared rounding step.

### Reporting-period normalization and conversion

- **Discrete quarter:** standalone flow for one issuer fiscal quarter. Do not treat a cumulative YTD flow as a discrete quarter.
- **Year-to-date:** cumulative flow from that issuer’s fiscal-year start through a source-stated period end.
- **Annual:** source-reported full fiscal-year flow. Preserve the source fiscal year and exact dates/duration, including 52- or 53-week years.
- **Trailing twelve months:** source-reported rolling-12-month flow or a derived period explicitly validated to represent the trailing 12 months. Do not label an arbitrary sum of four rows as TTM.
- **Instant:** point-in-time balance-sheet observation at a stated as-of date. Never sum it or subtract it as if it were a flow.

**YTD to discrete-quarter rule:** derive `quarter(n) = YTD(n) - YTD(n-1)` only when both are complete, non-restated-or-reconciled observations for the same security, metric mapping, currency/unit/scale, accounting and consolidation basis, fiscal calendar/year, and contiguous sequential fiscal periods, with verified fiscal-year start and endpoints. Q1 YTD can equal Q1 only if its start is the verified fiscal-year start and it covers the full first quarter. If a period is missing, incomplete, mismatched, ambiguously mapped, or restated inconsistently, do not derive the quarter. Preserve the two source observation IDs and a versioned derivation record.

**TTM rule:** prefer a provider-defined TTM observation when its definition and period are known. Otherwise derive only from four contiguous, complete, non-overlapping discrete quarters with compatible metric/basis/currency/scale/scope and a continuous fiscal interval that the source calendar identifies as the trailing four-quarter year. Keep exact start/end and total duration. If a 53-week year is included, disclose the 53-week interval and label it as trailing four fiscal quarters; do not silently normalize one week out or present it as an exact 365-day interval. If the evidence does not support the TTM label, the metric is unavailable.

**Fiscal calendars:** key comparisons to issuer fiscal-year/quarter IDs and exact source dates, not calendar quarter numbers. For a 52/53-week company, preserve any extra week. Compare annual/YTD observations only on a compatible fiscal basis and show duration differences; do not insert a missing week, shift periods, or normalize per week without a separately approved formula. Balance-sheet ratios use observations with the same effective date and compatible statement scope.

### Initial financial metric-definition catalogue (proposed)

All definitions below are proposed `v1` semantics, not provider-confirmed mappings or founder-approved accounting policy. Store results as decimal values with input observation/calculation IDs, formula version, unit/currency, periods, and calculation timestamp. Use exact source values internally. Proposed presentation rounds percentages to one decimal place and ratios/multiples to two decimal places (half-up); currency amounts use the source currency and explicit scale, with no silent conversion. These display rules also require founder approval under D-34. No unsupported numeric thresholds are invented for “near zero.”

| Metric / formula version | Formula | Required fields and compatible period | Currency / unit | Missing-input behavior | Zero / negative denominator and other edge behavior | Display rounding |
|---|---|---|---|---|---|---|
| Revenue growth `revenue-growth/v1` | `(current revenue / comparison revenue - 1) × 100` | Revenue for two compatible flow periods: annual vs prior annual; discrete quarter vs same fiscal quarter prior year; or YTD vs corresponding prior-year YTD. Same metric mapping, basis, scope and comparable fiscal period. | Same reporting currency and scale; no conversion. Output `%`. | Unavailable if either revenue/period is missing, mismapped, or incompatible. | Comparison-period revenue must be positive; zero or negative base is `not meaningful`. Negative current revenue is flagged/unavailable pending metric mapping review. 52/53-week duration differences are disclosed, not normalized. | 1 decimal percentage point. |
| Gross margin `gross-margin/v1` | `(source-reported gross profit / revenue) × 100`. The current implementation does not derive gross profit from cost of revenue; any such derivation is future work requiring approved and verified source semantics. | Same flow period, fiscal start/end, accounting/consolidation basis and scope for numerator/denominator. | Same currency/scale; output `%`. | Unavailable if reported gross profit cannot be sourced with a verified mapping or revenue is absent. | Revenue must be positive. Zero/negative revenue makes margin not meaningful; negative gross profit is allowed and shown as negative when otherwise valid. | 1 decimal percentage point. |
| Operating margin `operating-margin/v1` | `(operating income / revenue) × 100` | Same compatible flow period/scope/basis. | Same currency/scale; output `%`. | Unavailable if either field is missing or semantically unmapped. | Revenue must be positive; negative operating income is valid and yields a negative margin. Zero/negative revenue is not meaningful. | 1 decimal percentage point. |
| Net margin `net-margin/v1` | `(net income / revenue) × 100` | Same compatible flow period/scope/basis. Net-income definition (consolidated vs attributable to parent/common) must be consistent for the source. | Same currency/scale; output `%`. | Unavailable if mapping or compatible values are missing. | Revenue must be positive; negative net income is valid and yields a negative margin. Zero/negative revenue is not meaningful. | 1 decimal percentage point. |
| Operating cash flow `operating-cash-flow/v1` | Source-reported net cash from operating activities (no AI-derived arithmetic). | Cash-flow amount for the selected discrete quarter, YTD, annual, or validated TTM basis; comparisons require matching bases and compatible periods. | Preserve source currency and scale; display amount. | Unavailable if source field absent/unmapped; do not replace with zero. | Not a ratio; no denominator. Negative cash flow is valid and displayed as negative. | Keep exact value in storage; display source scale with up to 2 decimals. |
| Free cash flow `free-cash-flow/v1` | `net cash from operating activities - capital expenditures (cash-use magnitude)` | Compatible cash-flow period, accounting scope, basis and metric definitions. | Same currency/scale; display amount. | Unavailable if OCF or capex absent or capex semantics cannot be resolved. | Not a ratio; no denominator. Preserve negative FCF. If capex is reported as a negative cash-flow value, normalize to positive cash-use magnitude only with verified provider sign convention; never subtract a negative outflow twice. | Keep exact value in storage; display source scale with up to 2 decimals. |
| Current ratio `current-ratio/v1` | `current assets / current liabilities` | Both balance-sheet instant observations from same security, statement date, currency, accounting/consolidation basis and scope. | Same currency/scale cancels; output `x`. | Unavailable if either field is missing/unmapped or dates differ. | Current liabilities must be positive; zero/negative liabilities are invalid/not meaningful. Negative current assets are flagged and withheld pending source validation. | 2 decimals. |
| Debt-to-equity `debt-to-equity/v1` | `(short-term interest-bearing debt + long-term interest-bearing debt) / total shareholders’ equity` | Same balance-sheet instant/date/scope/basis. Debt components must be mapped so they are not double-counted. | Same currency/scale cancels; output `x`. | Unavailable if required debt or equity fields are missing or debt definition cannot be mapped. | Equity must be positive; zero/negative equity is `not meaningful`, not an infinite/negative normal ratio. Lease liabilities inclusion is unresolved and must be consistent with approved provider mapping. | 2 decimals. |
| Price-to-earnings `price-to-earnings/v1` | `equity market capitalization / trailing net income attributable to the matching equity holders` | Market capitalization at a stated price snapshot and compatible TTM net income for the same issuer/security/share class; the TTM end must be at or before that market-cap snapshot under an approved alignment rule, and price/as-of must meet approved freshness rules. | Market cap and earnings must use same currency and compatible scale; no implicit FX. Output `x`. | Unavailable if market cap, valid TTM income, share-class mapping, currency, or aligned price date is missing. | TTM net income must be positive; zero/negative income is `not meaningful`. Do not substitute a provider’s differently defined P/E without preserving its method/source separately. | 2 decimals. |

**Open accounting/provider definitions:** source-specific metric aliases; GAAP/IFRS/local-GAAP comparability; consolidated vs attributable net income; cost-of-revenue equivalence; capex sign and treatment; total-debt categories and lease liabilities; market-cap/share-class method; accepted TTM boundaries; restatement reconciliation; fiscal-year alignment tolerances; near-zero denominator materiality; display scale/rounding. D-34 keeps these unresolved for founder approval before implementation/claims.

### Normalization rules

- Preserve provider metric name and raw value alongside the normalized metric key.
- Preserve period basis, exact period dates, fiscal calendar/year/quarter, duration, 52/53-week designation, source scale, currency, accounting/reporting basis, consolidation scope, source as-of, retrieval time, and revision lineage.
- Map only fields with verified semantic equivalence. Ambiguous fields remain provider-specific/unmapped rather than guessed.
- Do not mix reported actuals with estimates/analyst expectations without separate approved scope and labels.
- Align valuation denominators and market-price observation dates explicitly. No cross-currency ratios without an approved FX source and methodology.
- Missing data remains null/unknown; never zero-impute. Partial responses remain partial.
## 4. Provider assessment

Provider details below summarize official vendor pages reviewed on 26 November 2026. Coverage, plan features, prices, and legal terms can change; obtain written, use-case-specific confirmation before purchase or launch.

| Candidate | Verified published capabilities | Costs/rights/coverage caveats | Assessment |
|---|---|---|---|
| **Finnhub** | Enterprise page describes global fundamental coverage; company profile; standardized financial statements for 30+ years, annually and quarterly; financials as reported; key metrics; and global company information. Its Enterprise plan states commercial use and redistribution rights. | Enterprise is custom/contact-sales; published plan page is not proof that every exchange, field, derived metric, generated report, storage period, or AI transmission is licensed for Aynox. Verify market-by-market identity, update cadence, corrections/restatements, currencies/accounting basis, end-user display/redistribution, derived outputs, AI processing, caching and deletion in writing. | **Preferred first fundamentals feasibility candidate**, not selected provider. Offers the most explicit match to long-history + reported/standardized fundamentals in the reviewed material. Must prove pilot securities and terms. [Official plan](https://api.finnhub.io/pricing-startups-and-enterprise). |
| **Twelve Data** | One API documents company profile and income statement, balance sheet, and cash flow endpoints; marketed coverage spans many markets. Business pricing pages list fundamentals on qualifying plans. | Business pricing differentiates tiers/market coverage and data uses; the plan page lists Venture business from $149/month and Enterprise from $1,099/month when reviewed, with specific display/distribution features differing by tier. The support guidance states redistribution can require a separate agreement; non-US price data may need extra approval; public AI products/model use are separate license classes requiring confirmation. Income-statement requests consume 100 API credits per symbol under the current credit schedule. Historical statement-depth and exact reporting/revision cadence must be measured from representative symbols and confirmed with vendor. A broad catalog is not proof of entitlement. [Business pricing](https://twelvedata.com/pricing-business), [commercial/personal-use rules](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), [fundamentals API overview](https://support.twelvedata.com/en/articles/5544954-twelve-data-overview), [API documentation](https://twelvedata.com/docs). | Strong continuity with the existing market-data shortlist and broad market API; pricing/redistribution and AI rights require careful, per-use confirmation. Keep as comparator. |

**Provider decision method:** do not treat vendor marketing totals as comparable coverage. Use an approved representative sample only when the deferred proof-of-concept stage is reached. For each proposed security, capture response completeness, exact periods, source currencies, metric definitions, updates/corrections, symbol mapping, errors, latency, call credits, and legal entitlement. No sample from a restricted development key may be shown to production customers. Do not change D-05 by this recommendation.

### AI provider comparison and recommendation

| Provider | Structured report support | Cost/reliability/security observations | Integration tradeoff |
|---|---|---|---|
| **OpenAI API** | Structured Outputs constrains output to a supplied JSON Schema; official docs describe JavaScript/Zod helpers. | Model prices and capability change by model. API prompts/responses are not used for training by default; default abuse-monitoring logs may retain content up to 30 days. Modified Abuse Monitoring/Zero Data Retention require eligibility/approval and have endpoint limitations. This is not a zero-retention guarantee. [Schema guide](https://developers.openai.com/api/docs/guides/structured-outputs), [pricing/model catalog](https://developers.openai.com/api/docs/pricing), [data controls](https://developers.openai.com/api/docs/guides/your-data). | **Recommended first benchmark adapter** because schema-first output fits the validation design and the existing stack is TypeScript. SDK convenience does not solve grounding or factuality. Select exact model only after benchmark and vendor/privacy review. |
| **Anthropic Claude API** | Structured outputs support JSON Schema-constrained outputs through the Messages API, with documented limitations. | Token pricing is model-specific; current official schedule varies by model and may change. Verify retention, regional processing, data processing terms, and account controls before transmitting licensed or user-linked data. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [pricing](https://platform.claude.com/docs/en/about-claude/pricing). | Strong alternative benchmark, especially for long evidence sets; compare factuality, citation selection, latency, schema support, and cost on the same fixture set. |
| **Google Gemini API** | Structured outputs accept a supplied JSON Schema; Google’s JavaScript SDK supports Zod. | Pricing differs by model and tier. Google’s documented free tier says prompts may be used to improve products; paid service says content is not used for that purpose. Retention, processing location, paid-tier eligibility, and contract terms still need review. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output), [pricing and data-use tier notes](https://ai.google.dev/gemini-api/docs/pricing). | Viable alternative, particularly if cost/rate limits compare well; ensure only approved paid service configuration is used for any permitted customer data. |

**Why OpenAI first:** this is an integration/evaluation recommendation, not a claim of superior financial reasoning. Its published structured-output and TypeScript/Zod path suits the proposed validation-first pipeline, while server-side API data controls are documented. Start with the smallest currently available text model that passes Aynox’s own grounding, arithmetic, factuality, latency, cost, and refusal tests. Pin the model snapshot/config in every report. Keep the provider interface replaceable. Do not submit raw provider content or personal data until that specific provider’s terms, retention, and source-data processing permission are approved.

## 5. Research generation pipeline

1. **Request/authorization:** validate user/session and canonical `securityId`; enforce rate limits, idempotency, and generation limits.
2. **Entitlement preflight:** for each provider + dataset + market + contract version, evaluate requested operations independently: retrieval, storage, display, derivation, AI processing, retention, and redistribution. Missing/unverified permission is deny-by-default for that operation. Conditional permission requires its conditions to be satisfied and auditable. A generic “licensed” label is not a permission result. If customer-facing AI/report use is not expressly approved, do not publish customer-facing output.
3. **Retrieve:** resolve stable provider IDs; fetch profile/statements through fundamentals adapter, prices through the market-data adapter, news through the existing service, and ESG only from a verified source. Retain data only if the specific storage permission allows it.
4. **Normalize:** map source observations while preserving raw/source values, period basis, exact fiscal dates/calendar, currency/unit/scale, reporting scope and missingness. Record provider errors/partial coverage.
5. **Period-align and calculate:** apply the discrete-quarter/YTD/annual/TTM/instant rules. Derive quarter from YTD only under the explicit compatibility rule. Calculate catalog metrics deterministically and store formula and input lineage.
6. **Build permitted evidence snapshot:** assign stable evidence IDs only to items whose operations permit use; AI input requires `ai-processing` permission, customer output requires `display`, and persistence requires `storage`/`retention` permissions. Keep entitlement-scope references. Avoid full article text unless specifically authorized. Treat all source text as untrusted data.
7. **Generate structured claim drafts:** call only the configured server-side `ResearchGenerationProvider` with bounded evidence and strict schema. No tool access, web search, trading, or conversational turn state. Model output includes typed claims and references; it does not supply final validation status.
8. **Validate and render:** structurally validate bounded report references; validate snapshot/security identity and exact nested evidence fields; resolve numeric facts against observations or deterministic calculations and verify metric, period, unit, currency, formula version, and lineage. Render verified figures from server evidence only. Treat all generated prose as unverified interpretation: references do not prove relevance, entailment, or lack of contradiction. Reject malformed drafts; do not publish based solely on schema or reference validation.
9. **Assign status and persist version:** determine generation completeness separately from evidence freshness; save immutable evidence snapshot/hash, report/schema/prompt/model/formula versions, per-source timestamps, claim validations, and last refresh-attempt status under approved rights/retention.
10. **Render:** return safe display DTO with server-resolved citations and separate `generationStatus`, `freshnessStatus`, and latest refresh-attempt outcome. Show report generation/as-of times, data coverage and the existing News link.

### Report status calculation

- **Generation status** describes the published content: `complete` (all founder-approved required sections pass evidence rules), `partial` (meaningful supported sections exist, but one or more are unavailable/unsupported), `insufficient_evidence` (coverage cannot support a meaningful report), or `failed` (no valid report was published because generation/pipeline failed).
- **Freshness status** is independent and evaluated at `freshnessEvaluatedAt` against approved source/dataset-specific thresholds: `current` only when all relevant included evidence has usable dates and satisfies applicable rules; `stale` when relevant evidence is stale; `mixed` when known included sources are a mixture of current and stale; `unknown` when required timestamps or an approved freshness rule are missing. Numeric thresholds remain open under D-20 and related provider decisions.
- A report can simultaneously be `partial` and `stale`, `partial` and `mixed`, or `complete` and `stale`. Missing optional datasets affect completeness/coverage; they do not get disguised as a current observation.
- A failed **refresh attempt** is recorded separately. Preserve the last valid report and its original generation status/evidence. Recompute freshness from that old evidence and current approved policies; show the failed attempt and old report date. Do not claim it is current if its evidence no longer qualifies. If the previous report still meets the approved thresholds, it may remain `current`, but the failed refresh must remain visible. If no prior valid report exists, generation is `failed` and freshness is `unknown`.

If AI times out/refuses/truncates or validation fails, never publish the invalid draft or silently overwrite the last valid report. Provider failures yield partial/unavailable evidence without substituting demo data into a real-provider report.
## 6. Proposed persistence and caching (no schema changes in this task)

Possible conceptual records, subject to schema/retention design after founder approval:

- **CompanyProfileSnapshot:** security ID, normalized profile facts, source/provider, as-of/fetched time, coverage, hash, usage rights.
- **FundamentalObservation:** security ID, normalized/provider metric key, decimal raw value, currency/unit/scale, reporting interval, accounting basis, filing/as-of/retrieval times, provider record/source, revision, use rights.
- **CalculatedMetric:** metric key/value/unit/currency, formula version, exact input observation IDs, periods, calculation time.
- **ResearchEvidenceSnapshot:** security, generated snapshot time, ordered evidence IDs or immutable normalized payload, source hashes, data-use permissions.
- **ResearchReport:** security, status, report payload/schema version, provider/model/prompt version, snapshot ID/hash, generated time, validation result, error summary (no secret/raw credential data).
- **ResearchReportEvidence:** report/evidence relationship, claim/section reference and citation ordering.

Reports are immutable versions: new input or model version creates a new record, never mutates historical rendered evidence. Retention of provider raw data/evidence is conditional on the source license; where raw retention is prohibited, retain only legally permitted IDs/hashes/derived output or regenerate as contract allows. Store cache entries separately only if those cache durations are authorized.

Cache key should include `securityId`, requested period scope, provider and dataset revision/response hash, normalized input hash, news report revision, ESG snapshot revision, formula version, prompt version, JSON schema version, model snapshot/config, and license/use state. Cache expiration follows the applicable source-specific storage/retention entitlement and freshness policy; cache itself is not implicitly authorized by retrieval permission. Never share a report across user scopes unless product privacy and report visibility explicitly allow it.

## 7. Failure handling and operations

| Failure | Required behavior |
|---|---|
| Unknown/ambiguous security mapping | Stop before report generation; show identity needs review. |
| Provider partial data/no statement | Build partial report; unavailable metric remains missing; identify source coverage. |
| Provider timeout/rate limit | Bounded retry with backoff only for transient failure; use explicit partial/unavailable data status and independently evaluate freshness; no zero substitution. |
| AI refusal/truncation/invalid schema | Mark generation failed; retain last valid version; expose retry only under limits. |
| Invalid evidence IDs or numeric mismatch | Reject report output; do not publish; log validation category. |
| Rights disallow display/model processing/retention | Omit or stop; never override rights through configuration alone. |
| Stale cached data | Show freshness status and source ages separately from generation status; refresh only when permitted; preserve and date the last valid report on failure. |
| Prompt injection in news/source text | Treat source as quoted, untrusted evidence; no tool calls; validate claims/citations. |
| Cost or request abuse | Apply per-user/security quotas, budget alarms, concurrency caps, and idempotency. |

Operational numeric SLOs, retention, support ownership and alert escalation are open under D-25/D-28 and the new report lifecycle decision. They must be approved before a pilot service commitment.

## 8. Security, privacy and licensing controls

- Keep financial and AI API keys in server-side secret configuration; never expose them in client bundles, URLs, source control, logs, or telemetry.
- Authenticate/authorize report generation and reads; enforce security and user scope at the server. Rate-limit by account, security, and service budget.
- Send the minimum evidence necessary. Do not send user email, watchlist contents, or portfolio composition for a company report unless a later approved feature specifically needs them.
- Evaluate provider retention, training, data residency, subprocessors, contractual roles, incident notice, and deletion. Do not treat “not used for training” as “not retained.” OpenAI’s default API abuse-monitoring logs can retain content for up to 30 days; eligibility for reduced retention is not assumed.
- Provider market-data rights and AI vendor rights are independent: a market-data license may restrict use of its data in AI inputs, model outputs, caches, derivative reports, and customer displays. Obtain express written approval for each step.
- Technical entitlement verification establishes only the record's authenticated issuer, integrity, declared scope, and operation permissions. It does not establish that the provider has granted Aynox the underlying contractual or legal rights. Track legal/contractual approval separately; pending approval blocks production use even when technical verification succeeds. A valid cryptographic signature or provider API response is not legal approval.
- Before any production provider integration, evidence assembly must use authenticated entitlement verification for the exact provider, dataset, market, security/source, contract, environment, audience and operation scope. Development-restricted entitlements remain confined to controlled development fixtures. Technical verification never implies legal approval.
- Production request authorization and entitlement verification must be bound to the same trusted request context before production evidence can be assembled or used. Production report publication remains disabled until its separate authorization, data-rights, semantic-review and publication gates are approved.
- News source rights separately govern retrieval, storage, snippets/summaries, article text, model processing, citation, and retention. Preserve only allowed content and canonical source links.
- Development API keys/data must be labeled and separated from production; restricted development output is never shown to production customers.
- Logs should contain correlation IDs, provider/model name, versions, durations, cost tokens, validation categories, and status—not prompts, complete financial payloads, personal information, or credentials by default.
- Sanitize rendered generated text, escape markup, limit output lengths, and prevent markdown/URL injection. Citations must be server-resolved allowlisted source URLs.

## 9. Frontend integration and presentation

### Proposed hierarchy

On the existing company detail/research view:

1. Canonical company identity and provider coverage/freshness.
2. Latest market snapshot (still sourced by market adapter, not confused with statement dates).
3. Comprehensive research report status and generated/as-of dates.
4. Executive summary with clearly differentiated reported facts, calculated values, and interpretation.
5. Financial results/tables with period selectors, currency/units, source and filing dates.
6. Business drivers, opportunities, risks, and competitive context with evidence links.
7. Recent developments as a short cross-link into existing Company News Intelligence; do not render a second article feed or sentiment report.
8. ESG subsection only if verified/available; otherwise explain coverage state without presenting synthetic ESG as fact.
9. Sources, coverage, limitations, model/data versions and refresh state.

Use visible labels and icons/text for fact/calculation/interpretation (never color alone); show unavailability inline. On narrow displays, keep period and currency context attached to the figures. Do not implement visuals as part of this task.

## 10. Testing and evaluation strategy

### Deterministic software tests

- Provider contract tests for valid, partial, absent, malformed, rate-limited and unsupported-symbol responses.
- Security mapping tests for exchange suffixes, provider IDs, name changes, ambiguous names, and wrong-company records.
- Normalization tests for annual/quarterly/TTM/instant periods, currencies, units/scales, negative numbers, restatements, duplicate periods, and missing fields.
- Financial formula tests using independently hand-calculated fixtures; cover zero/negative denominator, currency mismatch, incomplete period, boundary rounding, and missing inputs.
- Evidence snapshot tests for stable IDs/hashes, rights filters, security identity, source timestamps, source revisions, and stale states.
- Structured output/schema tests for valid output, refusal, truncation, unknown keys, invalid enum, missing/extra evidence IDs, wrong-security references, unsupported number, fabricated citation, and advice language.
- Pipeline integration tests with fake provider/model adapters; prove API credentials never reach client props or logs, idempotency prevents duplicate work, report version is immutable, and failure preserves prior valid report.
- UI tests for complete/partial/no-data/stale/error, citation opening, dated/currency-labelled table, separate News link, responsive and keyboard operation.

### Model and product evaluation

- Create an expert-reviewed gold set across different exchanges, currencies, accounting periods, sectors, missingness patterns, and narrative cases. Do not use synthetic-demo facts as if they measure real-world correctness.
- Compare model candidates with the same frozen evidence snapshot, prompt/schema, and evaluation labels. Blind reviewers where practical.
- Measure supported-claim precision, numeric exactness, citation-to-claim relevance, contradiction rate, unsupported claim rate, correct abstention for missing/conflicting evidence, period/currency correctness, readability, latency, and cost/report.
- Run adversarial source-injection tests, stale and revised financial data cases, one-source/zero-source cases, mixed periods, missing statement types, and non-US symbols.
- Re-run the suite when provider/model snapshot, prompt, schema, normalization or calculation formula changes; retain versioned results. Model benchmark results do not replace deterministic math tests or legal review.
- Define threshold, reviewer qualification, language coverage, and release rule with founders before using any quality claim or opening to users.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Attractive prose outruns evidence | Claim-level evidence IDs, factuality evaluation, abstention and partial states. |
| Standardized fields lose original filing meaning | Keep source fields/basis and expose reported vs normalized value; verify mapping. |
| Period, currency, or price cutoff mismatch | Store period and currency on every observation/calculation; reject invalid comparisons. |
| Provider rights exclude AI or customer display | Written rights review before data ingestion and separate `permittedOperations`. |
| Vendor/model behavior changes | Pin snapshots/config; provider adapters; frozen regression evaluation. |
| Output looks like personal investment advice | Restrict schema and language; legal/product review; no personalized buy/sell/price target. |
| Data/model cost grows with refreshes | On-demand generation proposal, caching under license, quotas, cost telemetry and approved limits. |
| Current UI repeats news report | Single canonical research report, brief developments reference, direct news link. |

## 12. Founder approvals required before implementation

1. Approve the Phase 1 Milestone 4 scope and confirm whether it is in the Phase 3 controlled pilot release cut.
2. Select/authorize the initial fundamentals feasibility candidate (recommendation: Finnhub) at the correct deferred development stage; approve representative universe only when the approved proof-of-concept stage arrives.
3. Select production financial/market provider later under D-05 after field coverage, commercial/display/derived rights, AI processing, price, freshness, and exchange terms are evidenced.
4. Approve the initial AI provider for benchmark (recommendation: OpenAI), exact model/snapshot only after evaluation, and acceptable terms, data region, retention and cost ceiling.
5. Decide whether model processing of provider-derived financial values, news summaries, and ESG records is permitted by each source contract.
6. Approve report generation trigger, refresh/staleness rules, who can access versions, whether sharing is ever allowed, and retention/deletion rules.
7. Approve initial metric definitions and edge rules under D-34 (e.g. YTD quarter derivation, fiscal-calendar comparisons, free cash flow/capex definition, valuation alignment, denominator handling, and display rounding).
9. Approve evidence review set, reviewer roles, language(s), benchmark thresholds and release gate; no numeric thresholds are set here.
10. Approve user-visible research/non-advice language and legal review before external release.
11. Confirm owner for provider/model operations, cost/budget alerting, incidents, and support.

Existing confirmed decisions D-01–D-30 remain unchanged. D-05 and D-31–D-34 remain Open; provider recommendations remain recommendations only.
