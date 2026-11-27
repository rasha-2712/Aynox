# Aynox MVP Product Requirements Document

**Product:** Aynox  
**Version:** 1.1  
**Status:** Product direction confirmed; implementation/provider decisions are in the [decision register](aynox-product-decisions.md)  
**Audience:** Founders, product, design, engineering, data/ML, QA, operations

## 1. Product summary

Aynox is an AI-powered investment research and portfolio intelligence platform launching from Qatar. It helps beginner investors, existing retail investors, university students, and young professionals understand stocks through approachable company research and meaningful analytical depth.

The product combines stock discovery, market data, historical forecasting when validated, company news intelligence and sentiment reports, manually selected tracked-stock analysis, transparent ESG context, and community features. Global coverage will grow as data coverage, licensing, availability, cost, and quality are verified.

A tracked portfolio is a user-selected group of stocks for monitoring and analysis. It is not a record of user-owned assets. Aynox does not connect to brokerage accounts, synchronize actual holdings, or calculate actual holdings, cost basis, profit, or loss.

## 2. Goals and audience

### Goals

1. Make supported-stock discovery and company research approachable.
2. Provide market and historical data with source, exchange, currency, market status, and freshness.
3. Provide rigorous and qualified forecasts where evaluation supports release.
4. Analyze manually selected stocks individually and collectively.
5. Improve company-news relevance and provide sourced reports and sentiment context.
6. Provide transparent ESG scores and comparison context from verified sources.
7. Extend the platform with community interaction after the core research and portfolio experience.

### Target users

- Beginner investors seeking clear explanations and limitations.
- Existing retail investors seeking company, market, and tracked-stock analysis.
- University students and young professionals learning about markets or researching stocks.

Serve beginners accessibly without removing analytical depth. User research may prioritize an initial pilot audience/use case, but does not silently narrow the confirmed target audience.

### Proposed pilot measures

These are hypotheses, not results. Approve metric definitions, cohorts, and thresholds in the decision register before using as go/no-go criteria.

- Share of onboarded pilot users who track at least one stock.
- Share of tracked-stock users who view company/news/portfolio analysis in the same session.
- Seven-day return use among tracked-stock users.
- Share of quote views showing source, timestamp, and market/freshness state.
- Share of report articles with source links and company association.
- User comprehension of the index and difference from actual investment returns.
- No unresolved release-blocking privacy, security, data-rights, or accessibility issue.

## 3. Product vision and delivery sequence

### Product vision

1. Stock discovery and market data.
2. Stock forecasting subject to rigorous out-of-sample evaluation.
3. Portfolio analysis and monitoring of manually selected stocks.
4. Improved Yahoo Finance news filtering.
5. Structured company news reports with article- and company-level sentiment.
6. ESG analysis with transparent methodology, source attribution, and comparison context.
7. Community posts and interaction.

### Initial MVP: Phase 1 and Phase 2

**Phase 1 — Core investment research**
- Stock discovery and company profile for supported securities.
- Latest available market data, including real-time quotes where supported by the selected provider and applicable data entitlements, plus historical market data.
- Yahoo Finance company-news relevance filtering, matching, and deduplication, subject to source rights and availability.
- Structured reports with source attribution and article/company sentiment.
- Forecasting only if the approved evaluation gate passes; otherwise keep forecasts unavailable.

**Phase 2 — Portfolio intelligence**
- Manual add/remove of tracked stocks.
- Individual analysis and the equal-weighted, daily rebalanced index.
- Collective news/sentiment, sector exposure, concentration, supported diversification observations, and sourced ESG insights.
- Dashboard-based monitoring; advanced alerts are not required initially.

Phases 1 and 2 together comprise the initial MVP experience. The Phase 3 controlled pilot includes real authenticated accounts and private, server-persisted tracked lists; the identity and authorization foundation is a prerequisite to admitting pilot participants to private-watchlist functionality. The synthetic browser-local demo remains available separately and is not account data. Any import from that demo must be explicit and user-approved. Pilot release cut and supported securities depend on verified provider feasibility and remaining open decisions. The approved six-market proof of concept remains deferred until the appropriate development stage and is not part of this initial scope.

### Controlled MVP pilot: Phase 3

Evaluate the Phase 1–2 research and portfolio experience with a limited user group and supported securities. Participants using private tracked lists must authenticate; each list is persisted server-side and every read or mutation is authorized using the user’s verified identity. The synthetic browser-local demo remains a separate experience. Review pilot findings and material issues before prioritizing community and other extended features.

### Extended platform: Phase 4

Community posts and interaction, expanded ESG, additional markets/securities, and advanced monitoring/alerts follow review of the controlled MVP pilot. Community is in the product vision but is not a Phase 1–2 launch blocker or a Phase 3 pilot prerequisite.
### Current exclusions

- Brokerage account connections.
- Automatic synchronization of actual holdings.
- Actual investment accounting: quantities, purchase prices, cost basis, realized/unrealized P&L.
- Buy/sell instructions or guaranteed outcomes.
- Direct messages and private groups.

## 4. Definitions and portfolio methodology

- **Tracked portfolio:** User-selected securities for research; no ownership or position size is implied.
- **Tracked-stock price return:** Price change over a stated period using verified provider-adjusted prices that account for stock splits; cash dividends are excluded initially.
- **Tracked portfolio index:** Synthetic, equal-weighted daily index of manually selected stocks, compounded from 100 using each constituent’s local-currency price return; FX movements are excluded and it is not a common-currency or personal investment return.
- **Company news report:** Structured, dated synthesis of linked coverage, themes, and sentiment; it does not replace source articles.
- **Forecast:** Model estimate with horizon, data cut-off, uncertainty, and limitations; not a promise or recommendation.
- **Data freshness:** Age/status of provider data, shown with source and timestamp.

For each eligible constituent i and daily interval t, let P(i,t) be a verified, corporate-action-consistent price in that security’s local trading currency. Calculate daily returns on that security’s exchange-specific trading calendar. The initial index equally weights eligible constituents’ local-currency daily percentage returns and excludes FX movements; it is not a common-currency investment return. The interface must disclose this limitation. A common-currency index may be considered later if reliable FX data and an approved methodology are available. Verify that the selected provider-adjusted historical price field accounts for stock splits, excludes cash dividends for this initial price-return index, and treats symbol changes and other relevant corporate actions consistently. Never assume an adjusted-close field excludes dividends without verification.

- r(i,t) = P(i,t) / P(i,t-1) - 1
- r(portfolio,t) = (1 / N(t)) × sum over eligible constituents of r(i,t)
- I(t) = I(t-1) × (1 + r(portfolio,t)), with base index I(0) = 100.

N(t) is the number of eligible tracked constituents for interval t. Each constituent has equal weight at the start of each daily interval, with daily rebalancing. Use each security’s own exchange-specific trading calendar to determine valid daily intervals. If a constituent lacks a valid price for an interval, temporarily exclude it and equally reweight the remaining eligible constituents; disclose eligible, included, and excluded counts/coverage. Never treat a missing price as a zero return or silently carry a stale value. Record security additions and removals with effective timestamps. A newly added security contributes beginning with the next eligible calculation interval; a removed security stops contributing from its effective removal interval. Historical intervals retain the membership that applied then; never retroactively recalculate index history from the current tracked list. The UI must explain the local-currency synthetic price-return index and must not describe it as a common-currency return, globally invested portfolio return, user return, account value, profit, or loss. Exact timestamp boundaries and cross-exchange session-date alignment remain implementation details to define against the provider’s exchange calendars.

## 5. Feature requirements

### 5.1 Stock discovery and profile — Phase 1

Search supported tickers/company names and resolve canonical security identity. Show exchange, currency, sector when available, quote/history, market status, news/report, and forecast availability. Clearly identify unsupported or partially covered securities.

**Accept:** Supported queries resolve with exchange/currency where available; ambiguous, unsupported, empty, and partial results are explicit; no universal-coverage claim is made.

### 5.2 Latest available and historical data — Phase 1

Show the latest available market data, including real-time quotes where supported by the selected provider and applicable data entitlements, plus price/percent change, history, currency, exchange, session status, source, and timestamp. Numeric freshness/update targets remain open pending provider feasibility. Never silently show stale or delayed data as live.

**Accept:** Quote provenance, timestamp, currency, and freshness are visible; real-time is labeled only when supported by selected provider and applicable entitlements; stale, delayed, unavailable, and market-closed states are distinct; no numeric freshness claim appears before approval; chart period, units, gaps, and adjustment basis are clear; missing data is never rendered as zero.

### 5.3 Forecasting — Phase 1, gated

Select ticker, history window, and approved horizon. Show actual and forecast values, uncertainty, model/version, cut-off, and limitations. Validate data sufficiency. Expose only after the founder-approved out-of-sample gate passes; otherwise show unavailable/validation-pending state.

Evaluation must be chronological holdout or rolling-origin, compared with simple baselines, and report data window, horizon, metrics, and failure cases. Never present training fit as forecast accuracy or forecasts as investment instructions.

### 5.4 Company news intelligence — Phase 1

Use Yahoo Finance news as the intended initial source. Filter by company/security and time; match entities, deduplicate, and preserve headline, publisher, URL, and publication time. Verify source access, commercial/display rights, and operational feasibility. Another source requires approval, not assumption.

**Accept:** Filtered news is attributable and company-linked; duplicate, stale, delayed, empty, and partial states are explicit; relevance and sentiment are measured on reviewed evaluation data before quality claims.

### 5.5 Reports and sentiment — Phase 1

A selected-period company report includes company, period, as-of time, article count, linked articles, concise synthesis, key themes, article sentiment, aggregated company sentiment, method/version, and coverage limitations. Label generated analysis. Do not reproduce full article text unless rights permit. Sentiment is descriptive, not evidence of future price movement.

**Accept:** Report statements trace to cited coverage; sparse/conflicting/no coverage is disclosed; sentiment shows method/version and counts; unsupported factual or predictive claims are not presented.

### 5.6 Manual portfolio intelligence — Phase 2

Users add/remove tracked stocks. Show individual price return and the index defined above, plus sector exposure, concentration, portfolio/company news and sentiment, and diversification observations only when data support them.

**Accept:** Selection persists without quantity or purchase price. Deterministic examples verify equal daily weights, local-currency constituent returns, FX and cash-dividend exclusion, daily compounding, and base 100. Calendar fixtures verify each security uses its exchange trading sessions. Missing-price fixtures verify temporary exclusion, equal reweighting of eligible constituents, visible eligible/included/excluded coverage, and no zero-return substitution or stale-price carry. Add/remove fixtures verify effective timestamps, next-eligible-interval entry, removal from the effective interval, preserved historical membership, and no retroactive recalculation from the current list. Provider-field fixtures verify stock-split handling, dividend exclusion, and consistent symbol-change/other corporate-action treatment; adjusted-close dividend semantics are verified explicitly. The UI discloses local currency and FX exclusion and never calls the index a common-currency return or actual personal investment performance.

### 5.7 ESG — Phase 2; expanded in Phase 4

Show source/provider, as-of date, scale/direction, pillar values, methodology, coverage, and meaningful comparison context. Distinguish source values from Aynox-derived insight; do not treat unverified scores as objective facts or missing values as zero.

**Accept:** Incompatible/unverified scores are not ranked as comparable; portfolio coverage/aggregation is disclosed; derived insights trace to versioned input and method.
### 5.8 Community — Phase 4

Community posts and interaction follow Phases 1–2. Exact interaction and visibility scope require approval. Before public release, define posting rules, content reporting, moderation/removal, safe rendering, and accountable operations. Clearly distinguish user opinions from Aynox data and analysis.

### 5.9 Dashboard monitoring — Phase 2

Initial monitoring means a user-accessible dashboard with current/latest tracked-stock data and freshness labels. Notifications and advanced alerts are later enhancements unless approved separately.

## 6. Main user journeys

### A. Discover and research — Phase 1
1. Search a supported ticker/company.
2. Review identity, exchange/currency, quote, market status, and timestamp.
3. Inspect historical prices and relevant news.
4. Read structured report and linked sources.
5. View a forecast only if its release gate is satisfied.

### B. Build and monitor a tracked portfolio — Phase 2
1. Manually add supported stocks.
2. See an explanation that tracking does not imply ownership or invested amounts.
3. Review individual price returns and the equally weighted, daily rebalanced index.
4. Review sector exposure, concentration, and supported diversification observations.
5. Review news/sentiment and ESG with method and coverage disclosed.

### C. Controlled MVP pilot — Phase 3
Evaluate the Phase 1–2 research and portfolio journeys with a limited cohort, gather task and trust feedback, and resolve material issues before prioritizing Phase 4 extensions.

### D. Community — Phase 4
1. Open the community after its release.
2. Publish or interact within approved scope.
3. Report content for moderator review.

## 7. Functional requirements and acceptance criteria

FR IDs are stable design, implementation, and QA references. Phase 4 items do not block the Phase 1–2 experience or its Phase 3 controlled pilot.

### Identity and privacy — MVP foundation

The controlled Phase 3 pilot includes real user accounts and private, account-backed tracked lists. A visual-only sign-in flow does not satisfy this requirement: authentication, server-side persistence, and server-side ownership authorization must be implemented and accepted before private-watchlist pilot access. The synthetic browser-local demo remains separate; local tracking is not private account data, and any future import requires explicit user approval. These approved product requirements do not select an authentication provider or approve the database host, registration policy, MFA, session policy, or retention policy.

- **FR-01:** Pilot users authenticate to use private account features; provide approved registration, sign-in/out, and recovery flows. **Accept:** Valid/invalid/expired states are clear; unauthenticated users cannot access private data; the server verifies identity for every private operation.
- **FR-02:** User data is owner-scoped. **Accept:** Automated checks prove one account cannot read or mutate another account’s tracked list or private profile.
- **FR-03:** Account deletion and retention are defined. **Accept:** User-facing policy and system behavior match and are verified before pilot.
- **FR-04:** Sensitive data is protected. **Accept:** Credentials/secrets do not appear in client code, URLs, logs, or analytics.

### Discovery and market data — Phase 1

- **FR-05:** Search resolves supported securities. **Accept:** Canonical identity, exchange, currency, support/partial status, and unsupported/ambiguous cases are explicit.
- **FR-06:** Quotes include provenance and freshness. **Accept:** Provider, timestamp, currency, market status, and real-time, delayed, stale, or unavailable state are visible; real-time is claimed only when provider support and applicable entitlements permit it, and no numeric freshness promise is made before feasibility approval.
- **FR-07:** Historical charts are accessible and understandable. **Accept:** Period, units, adjustment basis, and gaps are stated; a text/table alternative exists.
- **FR-08:** Provider errors degrade safely. **Accept:** Bounded retries do not mislabel stale prices as current or substitute zero for missing data.

### Forecasting — Phase 1, gated

- **FR-09:** Inputs are validated. **Accept:** Invalid ticker/range/horizon, insufficient history, and provider errors yield recoverable states.
- **FR-10:** Forecasts expose uncertainty and provenance. **Accept:** Actual/forecast distinction, horizon, interval, model/version, and cut-off are visible.
- **FR-11:** Forecast performance evidence is out of sample. **Accept:** Any displayed metric has reproducible chronological evaluation, baseline, horizon, data window, and limitations; otherwise no reliability claim is shown.

### News and reports — Phase 1

- **FR-12:** News is filtered and deduplicated. **Accept:** Each result has source, link, publication time, canonical company association, and selected time window; no/partial/stale states are explicit.
- **FR-13:** Article and company sentiment are available. **Accept:** Report shows article-level output and company-level distribution, method/version, coverage, and evaluation evidence or limitations.
- **FR-14:** Reports are source-grounded. **Accept:** Period/as-of, article count, themes, synthesis, source links, and coverage limits are displayed; generated analysis is labeled.
- **FR-15:** News usage respects rights. **Accept:** Source access, storage, summaries, display, and retention follow approved terms.

### Portfolio and ESG — Phase 2

- **FR-16:** Users manage tracked stocks manually. **Accept:** Selection persists without asking for ownership, quantity, or purchase price.
- **FR-17:** Individual price returns are visible. **Accept:** Period, price-return basis, source timestamp, and missing data are clear.
- **FR-18:** Collective index follows Section 4. **Accept:** Deterministic tests verify equal-weighted local-currency constituent daily percentage returns, no FX conversion, daily rebalancing, compounding, and base 100; UI discloses it is not a common-currency return.
- **FR-19:** Index semantics are clear. **Accept:** UI explains local trading currency, FX exclusion, dividend exclusion, daily rebalancing, and historical composition; it never calls the index a common-currency return, globally invested portfolio return, or personal return/P&L.
- **FR-20:** Exposure/concentration is transparent. **Accept:** Equal-weight/count basis and unknown classifications are shown.
- **FR-21:** Diversification observations are supported. **Accept:** Period, sample coverage, and method are shown; insufficient data returns an insufficient-data state.
- **FR-22:** News/sentiment/ESG rollups disclose coverage. **Accept:** Included stocks, dates, counts, sources, and aggregation/method versions are visible.
- **FR-23:** ESG comparisons are sourced. **Accept:** Provider, date, scale, methodology, pillar values, comparison context, and gaps appear; unsupported comparisons are suppressed.

### Community — Phase 4

- **FR-24:** Community behavior follows approved scope. **Accept:** Publishing, viewing, edit/delete, visibility, and interaction permissions are tested.
- **FR-25:** Moderation exists before public release. **Accept:** Users can report; authorized moderators can review/action with audit record; content renders safely.

### Cross-cutting

- **FR-26:** Data panels support loading, partial, empty, stale, and error states. **Accept:** State is distinguishable and missing data never looks like a valid zero.
- **FR-27:** Phase 1–2 journeys are responsive and keyboard-accessible. **Accept:** Search, reports, forecast view, tracking, and dashboard work at approved mobile widths without clipping, horizontal page scrolling, or keyboard traps.
- **FR-28:** User-facing outputs are traceable. **Accept:** Source, as-of time, transformation/method version, and generated status are available where relevant.

## 8. Non-functional requirements

### Performance and resilience
- Proposed target: p95 cached dashboard reads under 2 seconds and uncached provider-backed reads under 5 seconds, excluding model/report jobs. Workload and measurement conditions require approval.
- Long-running work has bounded timeouts and progress/completion states.
- Use bounded retries, provider-aware caching, visible freshness, and graceful degradation.
- Run ingestion/analysis as managed work, not duplicated per web process.
- Proposed pilot availability objective: 99.5% monthly for core service, excluding documented external-provider outages; approval and measurement definition remain open.

### Security and privacy
- Protect secrets; do not log credential values.
- Use secure authentication/session handling, authorization, CSRF protections where appropriate, and rate limits.
- Minimize personal data; define notice, retention/deletion, analytics, and third-party processing.
- Restrict and audit administrative actions.

### Accessibility and responsiveness
- Target WCAG 2.2 AA for core journeys, subject to review.
- Provide keyboard access, focus visibility, semantic structure, sufficient contrast, and non-color status cues.
- Provide chart summaries/tables and reduced-motion support.
- Support approved mobile/tablet/desktop sizes without overlap or clipped core controls.

### Data quality and maintainability
- Preserve source, timestamps, currency, exchange, market status, coverage, transformations, and versions.
- Never silently replace missing values with zero or combine incompatible periods/currencies.
- Version data/API contracts and validate inputs/outputs.
- Use a provider-neutral market-data adapter and begin development with deterministic synthetic/mock market data. Twelve Data and Finnhub may be integrated later through adapters; final production provider selection remains open. Restricted development API data must not be shown to customers in production unless the applicable commercial rights permit it. Avoid sensitive payloads in operational logs.
- Test calculations, authorization, ingestion, core journeys, and reproducible model evaluation.

## 9. Core data concepts

- User: identity, authentication metadata, status, preferences.
- TrackedPortfolio: owner, tracked securities, effective membership start/end timestamps; no quantities/cost basis.
- Security: canonical symbol/name, exchange, currency, classification/source.
- MarketObservation: value, provider, market/ingestion timestamps, currency, market status, adjustment basis.
- ForecastRun: security, history window, horizon, model/version, cut-off, forecast interval, evaluation metadata.
- NewsArticle/NewsAnalysis: provider ID/URL, source/time, linked securities/rationale, rights state, sentiment/summary versions.
- ESGObservation: security, source, scores/pillars, scale, date, methodology, coverage.
- Phase 4 CommunityPost/Interaction/Report: author, content, tags, moderation/report state.

Retention for user data, provider data, news-derived text, and generated analysis requires approval before release.

## 10. Dependencies

1. Discovery needs canonical security identity and progressive verified global coverage.
2. Market data and forecasts need provider entitlements, each security’s exchange-specific trading calendar, local currency/adjustment semantics, and history; use verified split-adjusted prices with cash dividends excluded for the initial portfolio index.
3. Forecast release needs time-ordered evaluation, baselines, and an approved gate.
4. News reports need Yahoo Finance availability/rights, company matching, relevance/deduplication, sentiment validation, and attribution.
5. Portfolio analysis needs persisted manual selection with effective timestamps, exchange-calendar-aligned verified price-return data, classifications, and explicit missing-price coverage/reweighting.
6. Sentiment rollups need matching, time window, aggregation, and minimum-coverage rules.
7. ESG needs verified source/methodology, comparison context, and coverage rules.
8. Phase 4 community needs accounts, safe content handling, moderation, and operations.
9. All analysis needs provenance, freshness, partial-data handling, versioning, and monitoring.
10. Development begins with synthetic/mock market data behind a provider-neutral adapter. Production display requires appropriate commercial rights; restricted development API data is not production data.

## 11. Release sequence

| Phase | Scope | Release condition |
|---|---|---|
| 0 — Evidence, rights, and feasibility | Verify sources, exchange calendars, provider terms, forecast evidence, and pilot feasibility; establish mock-first provider-neutral data contract | Feasibility and rights documented; six-market proof of concept remains deferred |
| 1 — Core investment research | Discovery, latest available market data (real-time where provider and entitlements support it), history, news filtering, structured reports/sentiment, gated forecasts | Sources/rights and data states verified; forecasts remain unavailable unless gate passes |
| 2 — Portfolio intelligence | Manual tracking, individual/combined analysis, index, news/exposure/diversification, sourced ESG | Index verified and composition/coverage/method disclosed |
| 3 — Controlled MVP pilot | Evaluate Phase 1–2 research and portfolio experience with a limited cohort | Pilot results and material issues reviewed before Phase 4 extensions are prioritized |
| 4 — Extended platform | Community, expanded ESG, progressive market coverage, advanced alerts | Moderation, rights, owners, and pilot evidence approved |

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Provider scope/terms/cost do not support global coverage | Introduce securities progressively; verify before marking supported |
| Index mistaken for personal performance | Explain formula, dividend exclusion, manual selection, and no holdings |
| Weak forecast evidence | Gate release; compare out-of-sample with baselines and show uncertainty |
| News/sentiment/report errors | Preserve source links, evaluate, disclose coverage, allow error reports |
| ESG is unverified/incomparable | Show source/date/method/scale and suppress invalid comparisons |
| Community exceeds moderation capacity | Defer to Phase 4 with an accountable process |
| Provider/model costs exceed value | Measure cost per workflow before broad rollout/pricing |

## 13. Product measurement

Instrument privacy-conscious events for onboarding, search/profile, reports, forecasts, tracked-list changes, portfolio views, ESG, and Phase 4 community actions. Do not send secrets, unnecessary personal data, or raw private content to analytics.

Measure activation, task completion, repeat use, freshness, provider failures, news relevance/coverage, sentiment coverage, forecast gate/evaluation, index comprehension, ESG coverage, and Phase 4 moderation response. Definitions and thresholds are open decisions.

## 14. Release gates

Phase 1–2 core experience must meet these conditions before the Phase 3 controlled pilot:
- Defined pilot workflow, supported securities, source rights, and freshness behavior.
- Attributed news reports and evaluated sentiment with coverage states.
- Verified Section 4 index math and clear composition/dividend semantics.
- Forecast withheld or passing approved out-of-sample gate.
- Verified ESG sources and disclosed comparisons.
- Reviewed authentication, privacy/deletion, incident response, accessibility.
- Automated/core acceptance checks complete; no open critical security/data-disclosure issue.
- Qualified review of claims and data rights for intended markets.

Phase 3 is the controlled pilot of Phases 1–2. Phase 4 has separate moderation/operations gates and follows review of pilot findings.

## 15. Governance and source context

The [product decision register](aynox-product-decisions.md) records confirmed choices and open validation. The [startup roadmap](../aynox-startup-roadmap.md) describes sequencing. Neither implies implementation status.

Capstone materials are historical evidence only; independently verify feature behavior, sources, and performance before using them to support Aynox claims. Changes to coverage, portfolio semantics, rights, forecast evidence, ESG methodology, community scope, or data handling require founder review and documentation.
