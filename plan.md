# Aynox Product and Delivery Plan

**Status:** Proposed planning baseline  
**Purpose:** Define how the team can evolve the StoCast concept into Aynox, an investment research and decision-support platform.  
**Audience:** Product, engineering, design, data, and business stakeholders.

## 1. Executive summary

Aynox is the proposed next product direction, distinct from the existing StoCast product. StoCast is the current capability base: stock forecasting, ESG information, financial news and sentiment, and portfolio features. Aynox should bring relevant capabilities together so an investor can understand a company, assess opportunity and risk, compare alternatives, and monitor a portfolio in one research workflow.

The proposed initial audience is individual investors interested in GCC markets, with a staged launch beginning in one market and expanding only after validating data coverage, licensing, and customer demand. The product should support Arabic and English over time. It must make sources, data freshness, uncertainty, and the distinction between observed facts and model-generated interpretation visible.

The initial technical direction is a modest, modular system: Next.js/React/TypeScript for the web experience; Python/FastAPI for APIs and analytics; PostgreSQL for structured data; Redis/Celery for asynchronous jobs when needed; Prefect for scheduled data workflows where justified; S3-compatible storage for permitted files; and Render as a budget-aware deployment candidate. Yahoo Finance data via `yfinance` is acceptable for prototyping behind a provider adapter. Before commercial launch, data rights, coverage, quality, freshness, and redistribution terms must be reviewed and an appropriate provider selected.

Do not attempt to ship every concept at once. First prove that data is dependable and a small set of research workflows is useful. Then add transparency, differentiated analysis, and recurring-use features. Subscription tiers, GCC expansion, institutional offerings, and financial-advice boundaries require validation before commercialization.

## 2. Product context and transition

### Current StoCast capability base

Capabilities described in prior product discussions include:

- Stock price forecasting, described as Prophet-based.
- ESG scores and sustainability information.
- Financial news and sentiment, including a Benzinga integration mentioned in the product notes.
- Portfolio and watchlist-related functionality.
- An existing Express/Handlebars interface, separate Python AI engine, MongoDB, and Yahoo Finance integration.

Treat this as a starting point to inventory. Confirm what is implemented, maintained, licensed, and reliable before carrying it forward.

### Proposed Aynox product

- A coherent investment research and decision-support experience rather than isolated AI features.
- Forecasts presented as uncertain estimates with horizon, data provenance, and evaluation context.
- Company/instrument research with market data, fundamentals, news/events, and ESG context where coverage supports it.
- Comparisons, watchlists, and eventually portfolio monitoring.
- An assistant only when it can ground responses in traceable data and cited sources.
- Arabic and English support, with quality evaluated separately for each language.

## 3. Product principles

1. **Evidence before prediction:** establish data quality and basic research utility before advanced models.
2. **Transparency:** label sources, timestamps, calculation methods, uncertainty, and model outputs.
3. **Narrow market coverage first:** select one pilot market and a supported instrument universe; do not imply universal coverage.
4. **User control:** no trading, brokerage execution, or automated portfolio action in the initial scope.
5. **Cost discipline:** add infrastructure only when usage or reliability requires it.
6. **Provider independence:** isolate market, news, ESG, identity, and FX vendors behind adapters.
7. **Responsible language:** avoid claims of guaranteed returns and distinguish decision support from personalized financial advice.

## 4. Proposed delivery roadmap

### Phase 0: Discovery and repository assessment

- Inventory StoCast code, dependencies, data flows, features, deployment, and operational constraints.
- Confirm the first market, user segment, top research task, and supported instrument list.
- Test `yfinance` symbol and field coverage for internal prototyping; record gaps and review terms.
- Establish product success measures, data assumptions, and open decisions.

**Exit:** prioritized MVP scope, a documented baseline architecture, and a testable pilot universe.

### Phase 1: Data foundation and internal prototype

- Define canonical instrument and market-data schemas, provider adapter, ingestion job, provenance, and freshness metadata.
- Add validation for missing, duplicate, stale, and implausible records.
- Build a minimal instrument research page with price history and source/as-of labels.
- Establish baseline forecast evaluation and a reproducible development environment.

**Exit:** repeatable ingestion for the pilot universe, visible data limitations, and a working internal research flow.

### Phase 2: Invited-user MVP

- Add authentication, instrument search, watchlists, company overview, transparent forecast ranges, and news/event context where data permits.
- Add user-scoped persistence, error handling, accessibility review, and basic monitoring.
- Validate usefulness through interviews and observed task completion; address the largest data and usability gaps.

**Exit:** stable core workflows, acceptable data quality for the selected universe, and evidence that users return.

### Phase 3: Differentiation and controlled expansion

- Add comparisons, fundamentals/ESG context, portfolio monitoring, alerts, and grounded research assistance only where data and evaluation support them.
- Evaluate Arabic and English quality separately; expand market/provider coverage after due diligence.
- Establish commercial data rights, privacy/compliance review, support processes, and sustainable hosting economics before paid launch.

**Exit:** validated quality and demand, commercial rights, operational readiness, and approved expansion.

## 5. Initial technology direction

- **Frontend:** Next.js, React, TypeScript.
- **API and analytics:** Python, FastAPI, typed schemas, and OpenAPI.
- **Architecture:** modular monolith initially; separate services only for demonstrated scaling or ownership needs.
- **Database:** PostgreSQL; consider TimescaleDB only if time-series volume/query patterns justify it.
- **Jobs:** Celery and Redis when asynchronous workloads exist.
- **Pipelines:** Prefect where scheduled workflow visibility/retries justify it; avoid overlapping schedulers.
- **Storage:** S3-compatible object storage only for permitted raw files and artifacts.
- **Analytics:** Python; compare simple statistical baselines before adding complex models. Prophet may remain a benchmark if useful.
- **Deployment:** Render as the early candidate; verify current pricing, region, limits, uptime behavior, and backups before selection.
- **CI/CD:** Docker and GitHub Actions with controlled deployment triggers.
- **Initial market data:** `yfinance` for prototyping behind an adapter; replace or supplement it when coverage, reliability, or commercial rights require it.

The stack is a target direction, not a requirement to launch every component. Start with one web service and a small managed database. Add workers, Redis, and object storage only when workloads require them. Set budget alerts and review spend regularly.

## 6. Data-provider strategy

For the prototype, use `yfinance` behind a provider interface. Capture provider identifier, query/ingestion time, market timestamp, symbol mapping, and validation outcome. Do not assume that prototype access grants commercial redistribution rights or dependable GCC coverage.

Maintain a provider capability matrix covering markets, instrument types, history, corporate actions, fundamentals, currency, freshness, rate limits, and commercial terms. Before paid launch, obtain suitable written rights and validate a commercial source. A replacement must pass the same conformance and data-quality checks.

## 7. Success measures

- Data coverage, freshness, and validation pass rate for the supported universe.
- Task completion and time-to-answer for company research and comparison flows.
- Repeat usage and retention among invited users.
- Forecast performance versus simple baselines, reported by market and horizon.
- Assistant answer attribution and unsupported-claim rate, if an assistant is introduced.
- Operational reliability, incident frequency, and monthly cost per active user.

Avoid vanity metrics. Define a baseline, target, owner, and measurement window for each launch gate.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `yfinance` data is incomplete, delayed, unstable, or unsuitable for commercial use | Prototype behind an adapter, record provenance, test coverage, review terms, and obtain written commercial rights before launch. |
| GCC symbols, calendars, corporate actions, currencies, or fundamentals have gaps | Pilot one market, define canonical IDs, validate against references, and expose unavailable fields. |
| Forecasts imply certainty or suffer leakage/overfitting | Use walk-forward testing, simple baselines, horizon-specific metrics, intervals, monitoring, and careful language. |
| News summaries or assistant responses hallucinate or misattribute | Ground responses, cite sources, evaluate offline, allow abstention, and require review for high-impact workflows. |
| Arabic sentiment performs worse than English | Evaluate language-specific data and vocabulary; report quality separately and show low-confidence states. |
| ESG scores appear comparable despite different methods | Preserve provider/methodology and avoid unsupported aggregation. |
| Data use violates licensing or privacy requirements | Review terms and jurisdictional obligations; minimize personal data and define retention/deletion. |
| Scope or infrastructure cost grows too quickly | Use phase gates, budget alerts, and evidence-based expansion; avoid premature microservices/Kubernetes. |

## 9. Open decisions

- Which GCC market and exchange should be the first pilot, and which instruments are in scope?
- Which user segment and research task define MVP success?
- Which `yfinance` fields and symbols are dependable enough for internal evaluation?
- Which identity provider, deployment region, and Render plan meet security, uptime, and budget needs?
- Which news, fundamentals, ESG, FX, and corporate-action providers have suitable coverage and rights?
- What portfolio inputs are allowed, and what privacy/retention controls do users expect?
- What legal review and financial-promotion boundaries apply in the launch jurisdiction?

Resolve these through repository assessment, provider checks, user interviews, and legal/data-rights review. Record each decision, owner, evidence, and revisit date.
