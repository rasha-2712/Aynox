# Aynox Product and Technical Specification

**Status:** Proposed v0.1  
**Related roadmap:** [`plan.md`](plan.md)  
**Purpose:** Define product behavior, system boundaries, data contracts, quality requirements, and delivery acceptance criteria for Aynox.

## 1. Scope and terminology

Aynox is an investment research and decision-support platform. It may combine market/company data, financial news/events, transparent forecasting, fundamentals and ESG context, comparisons, portfolio monitoring, and later a retrieval-grounded research assistant.

StoCast refers to the existing product and codebase being reviewed as a source of capabilities. Aynox is a proposed product direction. This specification does not assume a destructive rewrite. Reuse is conditional on code, data, security, and operational assessment.

### Initial non-goals

- Order routing, brokerage integration, automated trading, or portfolio execution.
- Personalized buy/sell instructions or guaranteed returns.
- Universal real-time coverage of all exchanges.
- Claims that forecasts or sentiment reliably predict outcomes without validation.
- B2B licensing or institutional service commitments before rights, demand, support, and economics are validated.

## 2. Users and permissions

- **Visitor:** views public product information and can sign up/sign in.
- **Registered user:** searches supported instruments, reads research, and maintains personal watchlists; portfolio features may follow later.
- **Operator:** monitors ingestion and service health with role-limited operational access.
- **Administrator:** manages configuration/users with least privilege and audited actions.

Exact roles and identity provider remain open. Administrative access must use strong authentication. All user-created data must be scoped to the authenticated user/tenant. Every read and mutation enforces ownership server-side; hidden UI controls are not authorization.

## 3. Product experience requirements

- Responsive desktop and mobile layouts, keyboard navigation, semantic headings, sufficient contrast, and screen-reader labels.
- Clear supported-market and instrument coverage, including unavailable/partial coverage states.
- Display source and “as of” time near financial data.
- Distinguish observed facts, calculated metrics, third-party classifications, and model-generated interpretations.
- Support Arabic and English over time; evaluate and report their quality separately.
- Show uncertainty, known limitations, stale data, and errors plainly.

## 4. Core workflows

### 4.1 Instrument search and research

Users can search by company name, ticker, or supported identifier. Resolve symbols to canonical instrument IDs; show exchange/currency when results are ambiguous. An instrument page presents available price history and supported research modules, along with source, timestamps, and missing-data states.

### 4.2 Forecasts

Forecasts are optional research estimates. Show horizon, generation time, source-data freshness, uncertainty interval where available, and evaluation context. Never imply certainty or present a forecast as personalized investment advice. If data is stale, insufficient, or outside validated coverage, abstain or clearly mark the output unavailable.

### 4.3 News and events

Display source, publication time, ingestion time, instrument/entity mapping, and links where licensing permits. Sentiment and summaries are derived outputs and must be labeled. Do not imply that sentiment alone predicts returns.

### 4.4 Watchlists and later portfolio features

Users can create, view, update, and delete their own watchlists. Every operation checks ownership server-side. Portfolio holdings, valuation, alerts, and history are later capabilities requiring explicit privacy, retention, and data-source decisions.

### 4.5 Research assistant (later)

Responses must use retrieved, authorized sources; cite those sources and their timestamps; separate retrieved facts from generated interpretation; and abstain when evidence is missing or conflicting. Do not expose another user’s data through retrieval.

## 5. Data contracts and provider adapters

Use stable internal identifiers; symbols are lookup aliases and can change. A canonical instrument record should include:

- Internal instrument ID, display name, symbol, exchange/market, instrument type, currency, timezone, and active status.
- Provider mappings and provenance with effective timestamps.
- Data quality/coverage state and last validation time.

Market observations should record instrument ID, interval, market timestamp, ingestion timestamp, currency, values, adjustment basis, provider, and validation status. Normalize units and timezones. Preserve source provenance and avoid silently replacing valid data with invalid provider responses.

Define interfaces for market, news, ESG/fundamentals, FX, and identity providers. Keep vendor-specific fields, error mapping, and rate-limit handling inside adapters. Begin with `yfinance` for prototype market data only. Record its limitations and review its terms; do not assume commercial redistribution rights.

## 6. Proposed application architecture

1. **Web client:** Next.js, React, TypeScript for public and authenticated workflows.
2. **Application/analytics API:** Python, FastAPI, typed schemas, and versioned REST/OpenAPI initially.
3. **Domain modules:** instrument/company, market data, research, forecasting, news/events, ESG/fundamentals, watchlists, and later portfolio/assistant.
4. **Jobs:** Celery/Redis for ingestion and asynchronous tasks when workload requires them.
5. **Workflow orchestration:** Prefect for scheduled/retriable pipelines where it provides needed visibility; avoid duplicate schedulers.
6. **Data store:** PostgreSQL for normalized and transactional data; consider TimescaleDB or pgvector only when justified.
7. **Object storage:** S3-compatible storage for permitted raw files and artifacts, with retention controls.
8. **Observability:** structured redacted logs, metrics, traces, and exception reporting.

Start as a modular monolith. Keep APIs and provider boundaries clear; split services only when scale, reliability, or team ownership requires it.

## 7. Data pipeline requirements

1. Reconcile provider symbols to canonical IDs and exchange metadata; flag ambiguous/unmapped symbols.
2. Fetch incrementally with rate limits, idempotency, bounded retries, and provider-specific backoff.
3. Normalize timestamps, timezone, currency, intervals, units, and adjustment basis.
4. Validate schema, nulls, duplicates, plausible ranges, discontinuities, session/calendar alignment, and freshness.
5. Persist records and ingestion-run metadata transactionally; retain allowed provenance.
6. Expose last success, last attempt, lag, coverage, and validation issues to operators.
7. Reconcile samples against provider/exchange references; alert on stale or failed jobs.

Retries must be safe. Backfills must be bounded and observable. A bad response must not silently overwrite valid data.

## 8. Forecasting and model governance

- Establish naive and seasonal/statistical baselines for each instrument cohort and horizon.
- Use chronological train/validation/test splits and walk-forward evaluation; prevent leakage in preprocessing and model selection.
- Report sample sizes and metrics such as MAE/RMSE or suitable scale-normalized measures; define directional metrics precisely.
- Track interval coverage/calibration and baseline-relative performance.
- Record source-data vintage, training window, code/dependencies, parameters, and evaluation results for each release.
- Monitor drift, missing data, realized forecast error, and calibration; define rollback/deactivation thresholds.
- Do not choose complex models without stable measured improvement over baselines.

## 9. Security, privacy, and compliance

- Store secrets in managed configuration; scope and rotate credentials.
- Use TLS, encryption at rest, least-privilege identities, administrative MFA, and secure session/cookie settings.
- Enforce user/tenant ownership on every query and mutation; test cross-user access attempts.
- Minimize personal/portfolio data; define retention, export, and deletion behavior.
- Rate-limit authentication and expensive queries; validate external content and protect against injection and SSRF.
- Keep backups encrypted and access-controlled; define recovery objectives and test restoration.
- Review privacy, financial-promotion, data-licensing, and consumer-protection obligations with qualified counsel before public launch.
- Treat `yfinance` as prototype-only pending terms and use review; do not assume commercial redistribution rights.

## 10. Reliability, operations, and deployment

- Track API latency/errors, ingestion success/freshness, provider limits, job queue depth, forecast generation, and database health.
- Use correlation IDs and structured redacted logs; never log secrets or unnecessary portfolio details.
- Alert on sustained failures and stale critical datasets with deduplication and actionable runbooks.
- Separate development, staging, and production configuration/secrets.
- Start with a minimal Render deployment candidate and managed PostgreSQL. Add workers/Redis only when workloads require them.
- Verify current prices, limits, region, backup behavior, and uptime characteristics before production selection.
- Keep infrastructure reproducible, migrations reviewed, health checks enabled, and rollback/forward-repair procedures documented.
- Monitor hosting/provider spend and review monthly; avoid Kubernetes and extra services before measured need.

## 11. Testing and release quality gates

- Unit tests for domain rules, normalization, provider adapters, calculations, permissions, and validation.
- Contract tests for provider schemas and OpenAPI using fixtures.
- Integration tests for persistence, retry/idempotency, and user ownership.
- End-to-end tests for search, research, watchlist changes, and error/empty/unauthorized states.
- Data checks for freshness, duplicates, gaps, corporate actions, calendars, and symbol mapping.
- Forecast evaluation uses chronological splits and walk-forward comparison against baselines.
- Accessibility, responsive layout, localization, and security checks gate relevant releases.
- CI runs formatting, linting, type checks, tests, dependency/security checks, and production build.

## 12. First invited-user release acceptance criteria

1. A user can search/open an instrument in the declared supported universe, with clear ambiguous and unavailable states.
2. Market data includes source, currency, interval, and “as of” time; stale/missing data is visible.
3. Invalid provider responses do not silently replace previously valid data.
4. Forecasts are labeled as estimates with horizon and evaluation context, not guarantees or personalized advice.
5. A registered user can manage a private watchlist; server checks prevent cross-user access.
6. The UI distinguishes facts, calculations, third-party classifications, and generated interpretations.
7. Core flows cover success, empty, error, and unauthorized cases.
8. Operators can inspect ingestion status and respond to stale/failed runs.
9. Data terms, privacy, backup/restore expectations, and known limitations are documented.

## 13. Change control

This is a proposed v0.1 specification. Product, engineering, data, security, and legal owners should record material decisions and rationale as evidence changes. New requirements must identify user value, data dependencies, privacy/security impact, operational cost, and acceptance criteria. Revisit the pilot market, `yfinance` suitability, Render economics, and provider choices at each phase gate.
