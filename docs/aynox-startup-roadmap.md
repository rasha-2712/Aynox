# Aynox Startup Roadmap

**Status:** Working roadmap aligned to the Aynox product baseline  
**Purpose:** Sequence evidence gathering, product development, pilot, and responsible growth. This is not a delivery-date commitment.

## Product vision

Aynox is an AI-powered investment research and portfolio intelligence platform launching from Qatar. It serves beginner investors, existing retail investors, university students, and young professionals. The experience should be approachable for beginners while providing useful analytical depth.

Aynox helps users discover stocks, understand market data, review company news and structured sentiment reports, explore validated forecasts, and analyze manually selected stocks individually and collectively. Transparent ESG insights and community posts/interactions are also part of the product vision.

A tracked portfolio is a user-selected set of stocks for monitoring and research. It is not an investment account or a record of assets owned. Aynox does not connect to brokerage accounts, synchronize actual holdings, or calculate actual holdings, cost basis, or realized/unrealized investment returns.

## Market scope

Aynox launches from Qatar with a global stock-market direction. Supported exchanges and securities will be introduced progressively as reliable data coverage, licensing, availability, cost, and quality are verified. No product material should imply every global listing is supported.

For supported securities, display exchange, currency, market status, source, and data freshness. Start development with synthetic/mock market data behind a provider-neutral adapter; Twelve Data and Finnhub are candidates for later adapters, while final production provider selection remains open. Restricted development API data must not be displayed to production customers without appropriate commercial rights. Provider and coverage questions are tracked in the [product decision register](product/aynox-product-decisions.md). The approved six-market proof of concept remains deferred until the appropriate development stage.

## Roadmap principles

1. Preserve the confirmed product vision while sequencing work so core research and portfolio intelligence come first.
2. Gather user and technical evidence before making performance claims, promising broad coverage, or scaling infrastructure.
3. Treat data rights, forecast validation, trust, privacy, and moderation as product requirements.
4. Do not present forecasts as guarantees or tracked-stock performance as a user's actual investment return.
5. Do not announce dates or coverage without approved plans and verified provider capability.
6. Separate provider facts, derived calculations, generated analysis, and user content.

## Roles and ownership

These are proposed roles from the startup plan; co-founders should confirm assignments.

| Role | Proposed owner | Accountable for |
|---|---|---|
| CEO | Shaza | Product direction, customer focus, partnerships, funding narrative, go/no-go |
| COO | Rasha | Research operations, pilot coordination, business model, documentation |
| CTO | Sara | Architecture, provider feasibility, security, forecast evaluation |
| All co-founders | All | Customer learning, major scope decisions, evidence review |

## Phases and exit criteria

Phases 1 and 2 define the core research and portfolio experience; Phase 3 is the controlled MVP pilot that evaluates that experience before Phase 4 extensions are prioritized. This sequence carries no delivery-date commitment.

### Phase 0 — Verify evidence, rights, and feasibility

**Goal:** Establish which prototype claims, data sources, and model results have evidence.

**Work**
- Review capstone reports, demo materials, and prototype as historical evidence; do not assume they are production-ready.
- Inventory data sources, rights, coverage, freshness, cost, and technical limits.
- Record forecast inputs, outputs, evaluations, baselines, and limitations; mark unsupported claims unvalidated.
- Verify candidate global market coverage for the intended pilot securities.
- Assess Yahoo Finance news availability/rights and candidate ESG coverage/methodology.
- Establish a provider-neutral market-data contract using synthetic/mock data first; document development versus production data entitlements.
- Route any discovered credentials or private data through the approved security response process; this roadmap does not claim remediation.

**Deliverables:** Evidence inventory; provider register and mock-data contract; forecast evaluation plan; decision list with owners.

**Exit criteria:** Data lineage is understood; initial market/news/ESG feasibility is known; forecasts are evidenced or gated; open decisions are recorded.

### Phase 1 — Core investment research

**Goal:** Deliver a company research experience using reliable market and news information.

**Scope:** Stock discovery; latest available market data, including real-time quotes where supported by the selected provider and applicable data entitlements, plus historical data for supported securities; improved Yahoo Finance news filtering, relevance, company matching and deduplication; article and company sentiment; structured, source-attributed reports; forecasting only after its evaluation gate passes. If approved, Milestone 4 extends Phase 1 with evidence-grounded company research combining verified financial fundamentals, relevant news, and verified ESG data where available; see the [Milestone 4 PRD](product/aynox-milestone-4-prd.md) and [technical design](product/aynox-milestone-4-technical-design.md). This scope remains proposed until founder approval and provider/license feasibility.

**Work**
- Define the supported-security catalogue and unsupported/partial states.
- Verify quote/news coverage, rights, freshness, and operational limits.
- Evaluate news matching, relevance, deduplication, and sentiment.
- Evaluate forecasts using chronological holdout or rolling-origin data and simple baselines.
- Validate the company-research workflow with users across the confirmed audience.

**Deliverables:** Company research workflow/data contract; news report structure; forecast evidence or explicit hold; user research findings.

**Exit criteria:** Users can find supported stocks and interpret data freshness; news is attributable and company-relevant; generated analysis is labeled and non-predictive; forecasts are either evidence-gated or withheld.

### Phase 2 — Portfolio intelligence

**Goal:** Turn manual stock selection into individual and combined analysis without implying ownership.

**Scope:** Manual add/remove with effective timestamps; individual price performance; an equal-weighted daily rebalanced synthetic index using each constituent’s local-currency daily price return and excluding FX movements; disclose that it is not a common-currency return. Use each security’s exchange-specific trading calendar. Temporarily exclude constituents with missing valid prices and equally reweight eligible constituents, disclosing coverage; never treat missing prices as zero returns. Use verified provider-adjusted prices that account for splits and consistently handle symbol changes and other relevant corporate actions; exclude cash dividends initially and verify field semantics rather than assuming adjusted-close behavior. Include news/sentiment rollups, sector exposure, concentration, supported diversification observations, and sourced ESG insights. Monitoring is dashboard-based; advanced alerts are later unless separately approved.

**Work**
- Implement and independently verify the daily index equation.
- Preserve effective membership timestamps and historical composition; define interval boundaries against each exchange calendar.
- Define temporary exclusion and equal reweighting when valid prices are missing; disclose constituent coverage.
- Verify provider price adjustment, split, dividend, symbol-change, and other corporate-action semantics.
- Validate sector, correlation, sentiment, and ESG coverage/aggregation.
- Test portfolio calculations with reproducible examples and user-facing explanations.

**Exit criteria:** Users manage a manual tracked list and see individual/collective analysis; daily calculations follow each security’s exchange calendar and equally weight eligible local-currency price returns; FX and cash dividends are excluded; missing-price constituents are temporarily excluded and eligible constituents equally reweighted with coverage disclosed; historical membership is preserved by effective timestamps without retroactive recalculation; verified provider-adjusted prices handle splits and relevant corporate actions; no screen implies common-currency or actual personal investment performance.

### Phase 3 — Controlled MVP pilot

**Goal:** Evaluate the Phase 1 and Phase 2 experience with a limited user group and supported securities before community and other extended features are prioritized.

Recruit a pilot cohort across the confirmed audiences; choose a primary use case; define participant notice, support, success measures, and feedback cadence. Track activation, task completion, repeat use, trust/understanding, freshness, and data-quality issues. Keep forecasts unavailable if their gate is unmet.

**Exit criteria:** Users complete core research/portfolio tasks; material trust, usability, privacy, and data issues have an approved mitigation; founders review results against approved measures.

### Phase 4 — Extended platform

**Goal:** Add product extensions after the controlled pilot evaluates core research and portfolio intelligence.

**Scope:** Community posts/interactions with approved moderation; expanded ESG; additional markets/securities as coverage and rights permit; advanced monitoring/alerts when validated.

**Exit criteria:** Each extension has a validated need, data/rights readiness, owner, and acceptance criteria. Community moderation is staffed before public access.

### Phase 5 — Business model and pricing

Compare freemium, subscription, B2B, and other models against customer/pilot evidence. Estimate market/news/ESG data, analysis compute, hosting, support, and payment costs. Test price ranges without treating stated interest as purchase intent. Deliver a business model, pricing evidence log, and cost scenarios. Choose limits only when use and cost evidence exist.

### Phase 6 — Responsible launch readiness

Choose hosting, authentication, storage, and observability based on approved architecture and team capacity. Establish protected secrets, least privilege, admin MFA, environment separation, dependency monitoring, rate limits, backups/restore, retention/deletion, incident response, and support ownership. Obtain qualified local review of data rights, product claims, and privacy obligations.

**Exit criteria:** No known critical security issue; restore and incident procedures demonstrated; data rights, claims, privacy, and pilot support approved.

### Phase 7 — Growth and coverage expansion

Use validated findings to pursue suitable programs and funding. Expand audiences, markets, and securities progressively; recheck rights, quality, costs, and claims. Each growth investment has an owner and measurable objective.

## Product boundaries

- No brokerage connections, automatic holding synchronization, quantities, cost basis, or actual investment P&L.
- Restricted development API data is not displayed to production customers without appropriate commercial rights.
- Community is in the product vision but sequenced in Phase 4.
- Advanced alerts are not required for initial dashboard monitoring.
- Forecasts, sentiment, and ESG must not be described as proof of future performance or objective sustainability without supporting evidence.

## Risk register

| Risk | Early response | Proposed owner |
|---|---|---|
| Weak/unproven forecast quality | Out-of-sample evaluation, baselines, release gate | CTO |
| Data rights, coverage, freshness, or cost | Verify terms and feasibility early | CTO + COO |
| Unclear first use case | Validate across confirmed audiences | CEO + COO |
| Index mistaken for actual returns | Explain formula and tracked-stock semantics | CEO + CTO |
| News/sentiment/ESG analysis unreliable | Evaluate, attribute, and disclose coverage | CTO |
| Community exceeds support capacity | Sequence later; define moderation owner/process | COO + CEO |
| Sensitive data or exposed credentials | Minimize data; secure access, MFA, backups | CTO |

## Near-term work sequence

No calendar dates or delivery commitments are established here.

1. Verify evidence, data rights, source feasibility, and open decisions.
2. Validate user problems and prioritize a pilot workflow across confirmed audiences.
3. Deliver Phase 1 research, with forecasts gated by evidence.
4. Deliver Phase 2 portfolio intelligence and verify index math.
5. Evaluate the Phase 1–2 experience in the Phase 3 controlled MVP pilot.
6. Prioritize Phase 4 community and extensions after pilot findings and operational requirements are approved.

## Decision governance

The [product decision register](product/aynox-product-decisions.md) records confirmed choices and open validation questions. It is the source of truth for decisions shared across the roadmap and PRD. Record owner, evidence, approver, and revisit trigger when an open item is resolved.
