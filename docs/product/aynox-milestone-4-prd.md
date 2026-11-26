# Aynox Milestone 4 Product Requirements Document

**Product:** Aynox  
**Milestone:** 4 — AI-powered investment research  
**Version:** 0.1  
**Status:** Proposed design — pending founder approval; not an implementation commitment  
**Owner:** Founders / Product  
**Related:** [MVP PRD](aynox-mvp-prd.md) · [Technical design](aynox-milestone-4-technical-design.md) · [Product decisions](aynox-product-decisions.md) · [Startup roadmap](../aynox-startup-roadmap.md)

## 1. Purpose and context

Milestone 4 proposes extending Aynox’s Phase 1 company research experience with comprehensive, source-grounded research reports. The report combines verified company and financial data, existing company news intelligence, and verified ESG information when available. A language model may organize and explain evidence; it is not the source of truth for facts, figures, citations, or investment outcomes.

This is a design proposal. Nothing in this document means that a financial data provider, an AI provider, a production data license, or this feature has been selected or implemented. The existing MVP direction and roadmap phase order remain authoritative: Milestone 4 supports **Phase 1 — Core investment research**; portfolio intelligence remains Phase 2, the controlled pilot remains Phase 3, and community/extended platform work remains Phase 4.

Repository inspection verified the following current-state facts:

- The app is a Next.js App Router, TypeScript, Tailwind modular monolith.
- `lib/providers/market-data.ts` defines an interface for securities, historical price series, and company news; `lib/providers/index.ts` currently selects `MockMarketDataProvider`.
- Company research and company detail use synthetic company profiles, market values, fundamentals previews, ESG previews, and synthetic price history. They also render the existing `CompanyNewsWorkspace`.
- News has its own provider, analysis, and structured report types under `lib/news` and `types/news.ts`.
- The Prisma schema currently stores users, securities, tracked portfolios/memberships, and market observations. It has no fundamental observations, research evidence, or AI research report records.
- No production financial fundamentals provider or AI report provider is currently wired into the inspected research flow.

These are implementation observations, not requirements or claims of production readiness. See the technical design for proposed interfaces and migration implications; this task does not change application code or the Prisma schema.

## 2. Product objective

Help the confirmed Aynox audiences understand what a supported company does, how its reported financial performance has changed, what relevant developments have been reported, and what limitations apply—without confusing source facts with calculations or interpretations, or research with personalized investment advice.

### Target users

The existing three confirmed audiences remain unchanged:

1. **Beginner investors** who need clear explanations of financial terms and uncertainty.
2. **Existing retail investors** who want company-level research and contextual evidence.
3. **University students and young professionals** learning about markets or conducting company research.

Milestone 4 does not narrow these audiences. Founder-approved pilot research may prioritize a first task or cohort later.

### Problems addressed

- Company information is spread across financial statements, company profiles, news, and ESG sources.
- Users can struggle to compare reported periods, distinguish stale or missing information, and understand financial metrics.
- News and financial facts need a traceable source and date to be trustworthy.
- Generated prose can sound certain even where input data is incomplete, stale, inconsistent, or unavailable.
- Existing company news reports already summarize developments; a new research report must add financial and business context rather than repeat the news report.

## 3. Product boundaries and scope

### In scope for the proposed Milestone 4

- A normalized company-profile and financial-data contract behind a provider-neutral adapter.
- Standardized annual and quarterly income statement, balance sheet, and cash-flow data for supported securities, subject to provider coverage and verified rights.
- Deterministic, period-aware calculations for selected growth, margin, profitability, cash-flow, debt, liquidity, and valuation metrics where required inputs are valid.
- Structured AI-assisted research reports grounded in a versioned evidence snapshot.
- Source and reporting-period provenance for financial values and report claims.
- Integration into the existing company research/detail workflow, with one canonical comprehensive report and a clear link/reference to the existing company news report.
- Explicit partial, stale, unavailable, conflicting, or insufficient-evidence states.
- Evaluation, quality gates, privacy and licensing review before any customer-facing use of provider data or AI.

### Out of scope

- A standalone chatbot, unrestricted conversational research, or autonomous agent.
- Brokerage integrations, automatic synchronization of actual holdings, investment accounting, or personalized portfolio returns.
- Buy/sell instructions, individualized suitability advice, guaranteed forecasts, price targets generated by the AI, or claims of future performance.
- Replacing or duplicating the existing article-level/company news report and sentiment workflow.
- Unverified ESG scoring, invented business/industry facts, unsourced competitive comparisons, or fabricated citations.
- AI web search or open-ended external retrieval in the report-generation path.
- Automatic creation of market, financial, news, or ESG data from model knowledge.
- New provider integration, database migration, or production launch as part of this documentation task. This design does not authorize production data use or customer-facing AI reports; each requires founder approval and verified contractual permissions.
- Changing confirmed portfolio index methodology, forecasting validation requirements, audience, global-market direction, or community sequencing.

## 4. User stories

- As a beginner, I can read a concise company overview and see explanations for financial terms without mistaking interpretation for reported fact.
- As a retail investor, I can inspect annual and quarterly results, see exact reporting periods and source metadata, and compare only compatible periods.
- As a student, I can follow each report statement to its supporting data or article and understand how the report was generated.
- As a user, I can tell whether a value is provider-reported, deterministically calculated, or an AI interpretation.
- As a user, I can see that data is incomplete or stale rather than receive a confident-looking report that fills gaps.
- As a user reviewing news, I can open the existing news report and its articles without seeing the same developments unnecessarily repeated in the comprehensive report.
- As a user, I can distinguish general research from a personalized recommendation or actual investment performance.

## 5. Functional requirements

### FR-4.1 Company identity and coverage

Resolve a company through the repository’s stable security identity and provider mapping, not display-name equality. A provider may use a different symbol, exchange code, or company label; mappings must be explicit and reviewable.

**Acceptance criteria**

- Each report is associated with a canonical `securityId`, exchange, and symbol as resolved by the security catalogue.
- Ambiguous, unsupported, renamed, delisted, or unmapped provider records do not silently attach to another company; the UI gives an unavailable/needs-review state.
- Each provider response exposes its coverage status and retrieval timestamp; the report does not imply universal global coverage.

### FR-4.2 Company profile and business context

Show sourced company profile facts (business description, products/services, sector/industry, and other available company facts). Competitive positioning and market context may be included only when supported by linked evidence in the report input. Missing items are marked unavailable or omitted; model prior knowledge is not an acceptable source.

**Acceptance criteria**

- Every displayed factual profile item has a provider/source and `asOf` or retrieval date, or is labelled synthetic in non-customer demonstration mode.
- Unsupported fields are omitted or shown as unavailable, never generated to complete a template.
- The company’s source identity and the report’s covered security are visible together.

### FR-4.3 Financial statements and reporting-period semantics

Present available income-statement, balance-sheet, and cash-flow observations with the provider-reported values and labels preserved separately from Aynox-normalized names. Every observation must identify its **period basis** as one of: `discrete-quarter`, `year-to-date`, `annual`, `trailing-twelve-month`, or `instant` (balance-sheet point-in-time). Preserve exact period start/end, fiscal year identifier, fiscal quarter, source period label, fiscal-calendar identity when available, duration/week count when available, filing/statement date, currency, unit/scale, accounting/reporting basis, provider, source reference, fetched time, and revision/restatement metadata.

A discrete quarter is a stand-alone flow over one quarter. A year-to-date (YTD) flow is cumulative from that issuer’s fiscal-year start through the stated period end. An annual flow covers the source-reported fiscal year, including 52- or 53-week years. A trailing-twelve-month (TTM) flow covers the source-defined rolling twelve-month period. An instant observation (for example, cash or debt on a balance-sheet date) is a value at a date, not a duration flow. Do not add or compare instantaneous observations as if they were period flows.

A YTD flow may be converted to a discrete quarter only by subtracting the preceding compatible YTD observation from the current YTD observation. Both records must have the same security, normalized metric, reporting/accounting basis, consolidation scope, currency and unit; belong to the same issuer fiscal year/calendar; have contiguous fiscal period endpoints; and represent complete source observations for consecutive fiscal periods. Q1 YTD may equal Q1 discrete only when the provider confirms it begins at fiscal-year start and covers the complete first quarter. If any condition is unverified, retain the YTD basis or mark the discrete-quarter value unavailable. Never derive a quarter from annual totals, incomplete records, mismatched fiscal years, incompatible periods, or point-in-time balance-sheet values.

Use each issuer’s actual fiscal calendar and exact start/end dates. Do not assume calendar quarters or a January–December year. Preserve a 52/53-week fiscal-year designation and any extra week; do not silently normalize it to 52 weeks. Comparable annual/YTD growth can be shown on the source’s reported basis only when the fiscal comparison is compatible, with duration differences disclosed. Any per-week normalization or alternative calendar alignment requires an approved method.

**Acceptance criteria**

- Every financial figure displayed to a user has provider/source, canonical security identity, period basis, exact period/as-of date, currency/unit/scale where applicable, and retrieval/as-of metadata.
- UI distinguishes discrete quarter, YTD cumulative, annual, TTM, and instantaneous balance-sheet data; tables never label YTD as a stand-alone quarter.
- A derived quarter is emitted only when all compatibility/continuity checks above pass and retains both YTD input observation IDs plus its derivation rule/version. Incompatible or incomplete records produce no quarter value and an explanation.
- Annual and YTD comparisons preserve the source fiscal calendar and show 52/53-week duration differences. No calendar remapping or per-week normalization happens silently.
- Missing and not-reported values remain missing, never zero. Restatements preserve source/revision lineage or disclose if unavailable.
- Financial statement periods are not presented as real-time market data.
### FR-4.4 Deterministic financial calculations

Calculate metrics in application/domain code from validated normalized observations; the language model does not calculate or author numeric values. The initial proposed catalogue is specified in the technical design and includes revenue growth, gross/operating/net margins, operating cash flow, free cash flow, current ratio, debt-to-equity, and price-to-earnings valuation. Each metric definition must state formula/version, required observations, compatible period bases, currency/unit rules, missing-input behavior, denominator handling, and display rounding. Provider-specific field mappings and unresolved accounting conventions remain open until approved.

**Acceptance criteria**

- A calculated metric contains formula version, calculation provenance/IDs, input observations, source periods, security, currency/unit, valuation price cutoff where relevant, and calculation time.
- No value is calculated if required fields are missing, periods or consolidation/accounting bases are incompatible, units/currency cannot be reconciled, or the denominator is undefined/non-meaningful under the approved rule.
- Negative or zero denominators follow the metric catalogue; a mathematically available but misleading ratio is not rendered as an ordinary multiple/percentage.
- Valuation metrics disclose the price/market-cap as-of and the earnings period; stale or incompatible values are suppressed or explicitly qualified.
- Deterministic fixtures verify formulas, period compatibility, YTD-quarter conversion, 52/53-week handling, rounding, missing inputs, currency/unit mismatch, and denominator edge cases.
### FR-4.5 Evidence and claim-level provenance/validation

Build a bounded evidence snapshot before report generation. Model output is a structured set of claim drafts, not trusted prose. Each draft identifies claim type (`reported_fact`, `numeric_fact`, `calculated_metric`, or `interpretation`), text, optional metric identifier, optional numeric value and unit/currency, optional reporting period and basis, supporting observation IDs and/or calculation IDs, and evidence IDs. The server resolves every reference and assigns validation status (`validated`, `rejected`, or `review_required`); the model cannot set its own validation status. Every source/dataset is governed by operation-specific permissions for retrieval, storage, display, derivation, AI processing, retention, and redistribution, scoped to provider, dataset, market, and contract. An unverified or generic “licensed” state does not grant an operation; missing permission is denied by default.

**Acceptance criteria**

- A valid evidence ID alone never makes a claim acceptable. Server validation checks claim type, requested/canonical security identity, existence and security ownership of every supporting observation/calculation/evidence ID, evidence-to-claim relationship, and compatible reporting period.
- Numeric facts must match the source observation after only approved unit/display rounding. Calculated claims must match the deterministic calculation record, formula version, and complete input lineage. Currency, unit/scale, period basis, start/end, fiscal period, and security must match the referenced values or an explicitly approved conversion/mapping.
- Numeric values displayed in financial fact/calculation claims are rendered from the validated observation or calculation by the server, not copied from free-form model prose. The model cannot introduce a second unsupported number in the claim text. Structured claim typing, exact value/period/source checks, and deterministic rendering are primary controls; numeric-token scanning of any remaining explanatory prose is defense in depth, not the sole validator.
- Claims that fail an invariant are rejected or excluded before publication. A report with excluded claims is downgraded to partial/insufficient evidence or failed according to the approved report rules; invalid content is never shown while validation is pending. A claim marked `review_required` is also withheld until resolved; it is not implicitly approved.
- Interpretations are explicitly labelled and cite supporting evidence/calculations. Missing, conflicting, stale, or thin evidence is disclosed.
- External articles are untrusted input, cannot change instructions or call tools, and cannot introduce uncited sources/facts.
### FR-4.6 AI-generated research report

Generate a structured report containing, where supported:

1. Report identity, canonical security, generation time, covered period, source-data as-of times, report/schema/prompt/model versions, completeness status, and separate freshness status.
2. Executive summary built from validated claims.
3. Company/business overview.
4. Financial performance and compatible period comparisons.
5. Evidence-backed business strengths, growth opportunities, risks/weaknesses, and industry/regulatory/macro uncertainties.
6. Relevant recent developments as a concise reference to the existing company news report and source links.
7. Competitive context only where evidence exists.
8. ESG context only when source, methodology, as-of date, scope, and permissions are verified.
9. An overall research assessment that describes evidence coverage and limitations—not a buy/sell recommendation.
10. Source list and data limitations.

**Generation/completeness status and freshness are independent fields.** `generationStatus` is `complete`, `partial`, `insufficient_evidence`, or `failed`. `freshnessStatus` is `current`, `stale`, `mixed`, or `unknown`. The report also carries a separate latest refresh-attempt status/time. A report can be `partial` and `stale` simultaneously: it lacks one or more expected evidence sections and its included evidence is outside freshness policy. A failed refresh does not rewrite a previous valid report’s generation status; it records a failed attempt while the prior report’s freshness is evaluated from its own inputs and the applicable approved source-specific freshness rules.

**Acceptance criteria**

- A published report is AI-assisted/generated and labelled with generation time, source/reporting dates, completeness status, freshness status, and limitations.
- `complete` means all founder-approved required sections meet their evidence rules; `partial` means some meaningful sections are supported while others are unavailable; `insufficient_evidence` means evidence is too sparse/conflicting to support a meaningful report; `failed` means generation/pipeline failed before a valid report was published.
- Freshness is calculated independently: `current` only when relevant included evidence has usable timestamps and meets approved source-specific freshness policy; `stale` when the relevant evidence is stale; `mixed` when included sources are a known mix of current and stale; `unknown` when timestamps, rules, or required freshness evidence are unavailable. No numeric freshness threshold is assumed here.
- A stale/partial status is never collapsed into a single generic badge. Display both dimensions, source dates, and coverage.
- On refresh failure, preserve the last valid version and show its original report time, current freshness evaluation, and failed refresh time/status. Do not label it current solely because it is the most recent saved report. If no prior valid version exists, show generation `failed` and freshness `unknown`.
- Unsupported, mismatched, or unvalidated claims are excluded before publication. Refusal, truncation, schema failure, rate limit, timeout, and outage never silently overwrite a last valid report.
- If there is no meaningful evidence, show insufficient evidence without inventing an executive summary. No model confidence is presented as factual accuracy; no forecasts, price targets, or personalized recommendations are generated.
### FR-4.7 News and ESG integration

Reuse the existing company news intelligence and its separate company report. The comprehensive report may summarize the covered themes at a high level, cite the news-report/evidence IDs, show time range and coverage count, and link to the existing news workspace. It must not copy full article text or repeat the article report wholesale. ESG is included only from verified and permitted data, with source, score scale, scope, date, and methodology; otherwise its absence is explicit.

**Acceptance criteria**

- News sentiment is descriptive, not predictive, and clearly reflects the article sample/window.
- News summary counts and sentiment distribution derive from the canonical company news data/report, not AI-created counts.
- Full articles are not copied into the AI prompt or rendered unless the source license permits that use.
- Unverified synthetic ESG demos never enter a customer-facing factual report. Missing ESG does not turn into a neutral/zero score.

### FR-4.8 Research experience integration

Integrate the report into the current company research/detail flow. Keep the company news report in its existing dedicated workspace and expose an obvious link/section reference rather than creating a second, competing news report. Use a clear information hierarchy: overview/status → executive assessment → financial evidence → business/risk analysis → recent developments link → ESG (when supported) → sources/limitations.

**Acceptance criteria**

- A user can navigate from supported stock discovery to one canonical company research view and back to the relevant news report.
- A report section is visibly identified as generated interpretation where applicable; source facts remain distinguishable.
- Empty/loading/partial/stale/failed report states are designed for desktop, tablet, mobile, keyboard navigation, and screen reader labels.
- Visual placement is subject to a separate design review; this PRD specifies behavior, not a UI implementation.

### FR-4.9 Generation, refresh, version history, and freshness

The recommended initial behavior is user-triggered generation/refresh with permitted cached reuse of the same valid evidence snapshot. Preserve immutable report versions and their input evidence snapshots. Completeness/generation status does not change merely because evidence ages; freshness is recomputed independently under approved, source-specific rules.

**Acceptance criteria**

- The UI states when the report was generated, the as-of time/period of each included source class, `generationStatus`, `freshnessStatus`, and latest refresh-attempt result/time.
- A refresh creates a new version only after successful validation; prior versions retain their own statuses, evidence and model/prompt/schema/formula versions, subject to approved rights and retention.
- A failed refresh leaves the last valid report accessible with its freshness recalculated; it cannot be presented as current without satisfying current freshness rules. A failed initial generation has no published report and freshness is unknown.
- Idempotency prevents duplicate generation from repeated submits; user/service generation and cost limits are enforced.
- Cache keys include security, evidence/data snapshot hash, provider/dataset revisions, report schema/prompt/formula version, and model/version/configuration. Expired or operation-ineligible inputs are not reused.
## 6. Non-functional requirements

- **Grounding and correctness:** Prioritize source traceability and explicit noncoverage over fluent completeness. The evaluation gate must include unsupported-claim and citation-integrity checks.
- **Availability and recovery:** Bound provider/model timeouts and retries. Return partial/failed states; never label stale data as current. Operational targets remain open under existing decisions.
- **Performance and cost:** Measure end-to-end report latency and cost by model/data provider, report length, retries, and cache hit. Do not promise numeric targets until the pilot/operational decisions are approved.
- **Security:** Keep all data/AI keys on the server; validate authorization and security IDs; protect internal report endpoints; rate-limit and audit generation; redact secrets and unnecessary personal data from logs.
- **Privacy:** Minimize inputs to the model, disclose relevant third-party processing, define user deletion/report retention, and review data residency and vendor retention before production. No customer portfolio personalization is implied by this single-company research report.
- **Licensing:** Verify display, storage, derived data, summary, model-processing, and retention rights independently for every market/data class. Development entitlement is not production permission.
- **Accessibility and usability:** Follow the platform’s approved responsive/accessibility matrix; provide keyboard access, legible contrast, structured headings, citations understandable outside color-only status, and alternatives to chart-only information.
- **Maintainability:** Provider and model adapters are replaceable; provider-specific shapes do not leak into page components or report domain types.
- **Auditability:** Store enough source/normalization/formula/model/version metadata to reproduce what evidence was shown, subject to legal and provider retention constraints.

## 7. Main user journeys

### Journey A — Read a company report

1. User searches/selects a supported security.
2. Company view resolves canonical identity and shows current data/coverage/freshness state.
3. User opens the research report and sees its status, report time, and input data as-of times.
4. User reads evidence-backed summary and financial performance, opens citations to verify claims, and distinguishes facts/calculations from analysis.
5. User opens the existing news report for article-level detail; it remains a separate linked workflow.
6. User reviews unavailable/stale fields and report limitations before forming their own conclusion.

### Journey B — Refresh after a filing or material update

1. User sees current report age and data-period dates.
2. User requests refresh.
3. The service checks source permissions and fetches/normalizes eligible inputs.
4. The system builds an immutable evidence snapshot and deterministic metrics.
5. AI generates structured claims tied to evidence IDs; server validates schema and semantic invariants.
6. A new version is published only on successful validation; otherwise the old report is preserved with an explicit refresh-failed state.

### Journey C — Partial coverage

1. A provider lacks cash-flow statements or comparable periods for the selected security.
2. The report includes supported sections only and labels missing inputs.
3. Unsupported ratios and comparisons remain unavailable.
4. `generationStatus` is `partial` or `insufficient_evidence` as appropriate; `freshnessStatus` is evaluated independently and may also be `stale`, `mixed`, or `unknown`.

## 8. Dependencies and sequencing

1. **Phase 0 evidence/rights feasibility:** Confirm permitted financial-data display, storage, derivative calculations, company/news content, AI processing, and global market availability. Keep final provider decisions open until evidence and founder approval.
2. **Milestone step 1 — Data foundation:** Extend the provider-neutral domain contract with mock financial data and stable evidence provenance. This is a Milestone design phase, not a new roadmap product phase.
3. **Milestone step 2 — Financial analysis:** Normalize statements/periods and implement deterministic metrics with repeatable fixtures.
4. **Milestone step 3 — AI report generation:** Add a server-side provider adapter, structured schema, evidence-ID validation, and refusal/failure handling; begin with synthetic/mock fixtures only.
5. **Milestone step 4 — Integrated research experience:** Fit report into current Research/company detail flow and link to, rather than duplicate, the news report.
6. **Milestone step 5 — Evaluation and QA:** Grounding, arithmetic, citations, stale/missing/conflicting data, localization, quality, costs, and accessibility. Only after gates and rights approvals may licensed production provider data and customer-facing AI be considered.
7. **Phase 3 controlled MVP pilot:** The pilot remains an evaluation of the Phase 1 and Phase 2 core experience. Milestone 4 implementation must fit before that gate if it is included in the Phase 1 pilot release cut; release inclusion requires founder approval.

## 9. Success measures and release gate

No target values are approved in this proposal. Establish a frozen evaluation set before user-facing claims. Report:

- Evidence attribution coverage: report factual claims with valid evidence IDs / total factual claims.
- Unsupported claim rate, including unsupported numeric claims.
- Citation resolution and citation-to-claim relevance, evaluated by human review.
- Financial metric reconciliation against deterministic reference calculations.
- Period/currency/basis mismatch detection rate.
- Correct abstention rate for missing, stale, conflicting, and unsupported fields.
- News-reference accuracy against the existing report and selected coverage window.
- Expert/annotator ratings for factuality, readability, usefulness, and distinction between fact and interpretation.
- Report-generation latency, provider failure rate, retry rate, and cost per successful report.
- User task completion/comprehension and confidence calibration through an approved research plan.

Do not set arbitrary thresholds in advance of baseline/evaluation design. Founder approval is required for minimum acceptable thresholds, gold-set labeling, reviewers, languages, and release criteria. No external “accurate,” “comprehensive,” or “investment-grade” claim until supported by reviewed results.

## 10. Assumptions and open decisions

The following are proposals, not confirmed decisions:

- On-demand report generation and cached reuse is the initial default.
- Initial AI is used only for bounded synthesis of approved evidence, not data retrieval or calculation.
- The report may use licensed article-derived summaries only when source terms allow this processing and storage.
- A first financial-provider adapter can be benchmarked separately from final production selection.
- AI reports are accessible to the currently authorized user; cross-user report sharing/publication has not been approved.

Founder decisions are recorded in the [product decision register](aynox-product-decisions.md), including the AI provider and model/data terms, financial fundamentals provider/coverage/rights, and report generation, access, refresh, and retention policy. Existing open decisions D-05 and D-20 through D-28 and new D-34 remain open and unchanged unless founders approve a separate resolution; D-31 through D-33 also remain open as recorded in the register.

## 11. Conflicts with existing confirmed direction

This design has no intended conflict with the confirmed three audiences, global stock-market direction, provider-neutral/mock-first approach, tracked-stock methodology, forecasting evidence gate, Yahoo Finance news direction, descriptive sentiment, verified ESG requirement, exclusion of brokerage/accounting/chatbot, and Phase 3 pilot before Phase 4 community. Any future adjustment requires explicit founder approval and updates to the decision register.
