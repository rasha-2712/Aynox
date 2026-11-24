# Aynox MVP Product Requirements Document

**Product:** Aynox  
**Version:** 1.0  
**Status:** MVP baseline; founder approvals listed in Section 15  
**Audience:** Founders, product, design, engineering, data/ML, QA, and operations  
**Background:** StoCast university capstone; not a production specification

## 1. Purpose and direction

Aynox is an AI-powered investment research and portfolio intelligence platform. It brings market data, historical trends, stock forecasts, company news, news sentiment, ESG insights, and community posts into a coherent research workflow.

This PRD defines the initial product from the confirmed direction. The StoCast prototype and its claims are historical background only. They do not establish model quality, data rights, production readiness, or suitability for investment decisions.

The MVP portfolio is a **user-curated set of stocks to track**. It does not represent brokerage holdings. Users are not assumed to provide share quantity, purchase price, or transaction history. Aynox must not describe tracked-stock price changes as the user's investment returns, profit, or loss.

### Goals

1. Help users research supported public companies from one company view.
2. Provide current/latest and historical prices with clear source and freshness.
3. Analyze the tracked stocks individually and collectively using transparent methods.
4. Surface relevant company news, attributed summaries, sentiment, and ESG context.
5. Support community posts with basic safety and moderation.
6. Present forecasts as uncertain model outputs and publish no unsupported performance claims.

### Proposed pilot outcomes

These are proposed targets, not established results; founders should approve or revise before launch.

- ≥70% of users completing onboarding track at least one symbol.
- ≥60% of users adding a symbol view a company, news, or portfolio analysis panel in that session.
- ≥30% of users with a tracked portfolio return within 7 days during a controlled pilot.
- ≥90% of eligible quote views show a source timestamp and an explicit current, delayed, stale, or unavailable state.
- ≥95% of displayed news items in reports have a source link and company association record.
- No unresolved release-blocking privacy, security, licensing, or accessibility issues.

## 2. Target users and problems

### Primary users

- **Self-directed retail investors** who follow public companies and want to review price movements, news, and risk context efficiently.
- **Research-curious newer investors** who need plain-language explanations and clear separation of facts, analysis, and model output.
- **ESG-conscious or thematic investors** who want sourced ESG context alongside company and market research.

### Secondary users

- Active market observers following multiple companies or sectors.
- Community members sharing company research and discussing market topics.

The launch geography, supported exchanges, languages, age restrictions, and precise initial segment remain founder decisions.

### Problems addressed

- Research is fragmented across price pages, news feeds, ESG data, and personal spreadsheets.
- Users need help filtering company-specific coverage from general market news.
- A ticker list alone does not explain group performance, sector concentration, sentiment coverage, or how stocks have moved together.
- Forecasts, sentiment labels, and ESG scores can appear more certain than their inputs justify.
- Users need provenance, timestamps, limitations, and a way to inspect the underlying sources.

## 3. MVP scope

### Included

- Accounts and user-specific saved data.
- Manual stock search and add/remove to a tracked portfolio.
- Latest/live market data and historical price views.
- Individual and collective tracked-stock analysis.
- Historical-data forecasting with uncertainty and evaluation evidence.
- Improved company news filtering using Yahoo Finance news or another approved source.
- Company news reports with source links, summaries, sentiment, and coverage context.
- ESG company data and portfolio insights with source/methodology disclosures.
- Community posts and basic moderation/reporting.
- Responsive, accessible web experience with complete loading, partial, empty, stale, and error states.

### Explicitly excluded from the initial version

- Standalone chatbot.
- Brokerage account integrations, account linking, or trade execution.
- Automatic synchronization of actual holdings.
- User investment return, P&L, tax-lot, or allocation claims without actual positions and cost basis.
- Automated buy/sell recommendations, guaranteed outcomes, social trading, or copy trading.
- Direct messages and private groups.

## 4. Definitions

- **Tracked portfolio:** User-selected symbols saved for research. No quantity or cost basis is implied.
- **Tracked-stock performance:** Price movement for a symbol over a named period.
- **Tracked basket/index:** A normalized collective view of selected symbols using a disclosed weighting and rebalancing rule.
- **Investment return:** Return on actual invested capital; requires holdings, quantities, transactions, and cost basis and is outside MVP.
- **Company news report:** Dated synthesis of linked articles, coverage volume/themes, and aggregated sentiment; not a replacement for original articles.
- **Forecast:** Model-generated estimate with horizon, data cut-off, uncertainty, and model version; not a promise or recommendation.
- **Stale data:** Data older than its approved provider/use-case freshness threshold, clearly identified in the UI.

## 5. Feature requirements

### 5.1 Accounts and onboarding

**Purpose:** Protect personalized portfolios and support community participation.

Provide registration, sign-in/out, account recovery, and profile basics. Require authentication for private portfolios and publishing. Use production-suitable password/session handling, verification, and rate limits. Provide account deletion and retention behavior before public release. Never expose credentials or sensitive user data in browser code, URLs, logs, or analytics.

### 5.2 Company search and profile

**Purpose:** Provide one research hub per supported company.

Search by ticker or company name, resolve to canonical security identity, and show company name, symbol, exchange/sector when available, quote/history, forecast access, company news, ESG coverage, and community discussion links. Each data section identifies source and timestamp or an unavailable/partial state. Distinguish facts, derived metrics, generated analysis, forecasts, and user posts.

### 5.3 Market data

**Purpose:** Show timely prices and historical market context.

Display latest quote, price and percent change, and session range/volume where available and permitted. Show currency, market/session context, provider, and as-of time. Mark data as real-time, delayed, cached, stale, or unavailable. Do not promise real-time service until vendor entitlements and service levels are confirmed.

Use a replaceable provider adapter. Handle rate limits and outages with bounded retries, caching, visible freshness, and graceful degradation. Never silently present cached data as live.

### 5.4 Tracked portfolio intelligence

**Purpose:** Make a manually selected list useful for both individual and collective analysis.

Users can add, remove, search, and reorder tracked symbols. Portfolio view includes:

- Individual tracked symbol price and period change.
- Collective tracked-stock index/chart with the approved methodology and base date.
- Sector exposure and concentration based on clearly labeled ticker-count or equal-weight proxy.
- Portfolio and per-company news sentiment with article counts and selected time window.
- ESG coverage and summary across covered companies, with aggregation method.
- Diversification observations from sector mix and, where sufficient historical data exists, return correlations.

**Semantic safeguards:**

- Do not require or assume share quantities, purchase prices, or ownership.
- Do not label tracked-stock performance “your return,” “profit,” or “loss.”
- Do not imply equal-weight exposure represents the user's actual capital allocation.
- Disclose excluded symbols, missing sectors, currencies, or dates for partial metrics.
- Describe concentration/diversification rather than implying risk has been removed.

**Provisional group calculation (approval required):** Normalize each included symbol’s adjusted close to 100 at the period start, average daily normalized values equally, and rebalance daily. Display included/total symbol counts. Founders must approve this approach, corporate-action handling, currencies, missing dates, and minimum coverage before design/build lock.

### 5.5 Stock forecasting

**Purpose:** Let users explore potential price paths derived from historical data.

Select ticker, historical window, and approved forecast horizon. Display actual history, forecast path, uncertainty interval, data cut-off, model/version, and explanatory limitations. Reject inadequate or invalid history with a clear reason.

Any accuracy claim must use chronological holdout or rolling-origin evaluation, be compared with a simple baseline, and identify dataset window, horizon, metrics, and limitations. Do not present training fit as forecast accuracy. Do not present forecasts as investment instructions or guaranteed prices. Founders and the data/ML owner must approve the quality gate before enabling forecast claims.

### 5.6 Company news intelligence

**Purpose:** Find relevant reporting and summarize a company’s coverage over a chosen period.

Ingest company news from Yahoo Finance or another founder-approved, licensed source. Filter by company/ticker and time window, map articles to canonical entities, deduplicate, and display headline, source, publication time, and link. Company report includes article count, coverage dates, themes, generated summary, sentiment distribution, and source links.

Mark generated summaries and sentiment as analysis; show method/model version, coverage volume, and sparse/no-data conditions. Provide an error-reporting path. Do not reproduce full article text unless rights permit it. Ingestion must be idempotent, traceable, and versioned.

### 5.7 ESG analysis

**Purpose:** Add environmental, social, and governance context.

For covered companies, display provider, as-of date, score scale/direction, environmental/social/governance values, methodology link, and coverage status. Portfolio view aggregates only covered tracked names and shows covered/total counts and an explicit aggregation method.

Do not invent scores or convert missing values to zero. Distinguish third-party values from Aynox-derived metrics. If a normalized/composite score is created, disclose universe, weights, missing-data handling, and methodology version. Describe ESG information as context, not certification of sustainability or investment suitability.

### 5.8 Community posts

**Purpose:** Support user discussion around companies and market research.

Authenticated users can publish text posts with optional supported company tags, read a chronological feed, and edit/delete their own posts. Comments, reactions, and attachments require founder scope approval. Before public launch, provide posting rules, abuse reporting, moderation review, removal/escalation, and safe content rendering. Clearly distinguish user opinion from verified data and Aynox analysis.

### 5.9 Saved preferences

Persist tracked symbols and basic in-product preferences. Email/push alerts and price/news notifications are future enhancements unless explicitly approved.

## 6. Main user journeys

### A. Start researching

1. User understands Aynox’s purpose and limitations on the landing page.
2. User registers or signs in.
3. User searches a company by ticker/name.
4. User opens its profile and reviews quote freshness, history, news, sentiment, ESG coverage, and forecast availability.
5. User adds it to the tracked portfolio.

### B. Build and review a tracked portfolio

1. User manually adds several symbols.
2. Portfolio explains that the list does not represent holdings or invested amounts.
3. User views individual period price changes and collective indexed performance.
4. User inspects sector concentration and data coverage.
5. User opens individual news, ESG, sentiment, and forecast details.

### C. Read a company news report

1. User selects a company and time range.
2. Report shows article count, source links, date range, and coverage status.
3. User reviews themes and generated sentiment analysis.
4. User opens original reporting or flags a mismatch/error.

### D. Explore a forecast

1. User chooses a ticker, historical window, and horizon.
2. Aynox validates history and explains gaps.
3. User views actual prices, future forecast, uncertainty, and as-of time.
4. User reviews evaluation/baseline notes and limitations.

### E. Participate in community

1. Signed-in user opens the feed.
2. User publishes a text post and optionally tags a company.
3. Other users read and discuss using approved MVP interactions.
4. Users can report content; moderators review and act.

## 7. Functional requirements and acceptance criteria

Provider freshness limits, supported markets, and forecast quality thresholds must be approved before production readiness.

### Accounts/access

- **FR-01:** Users can register, sign in/out, and recover access. **Accept:** Valid/invalid/expired states are clear; private portfolio and write actions reject unauthenticated requests.
- **FR-02:** User data is owner-scoped. **Accept:** Automated authorization tests demonstrate one account cannot read or mutate another account’s portfolio/profile/private data.
- **FR-03:** Account deletion is supported. **Accept:** Product documents deletion completion and retention exceptions; deletion is verified end to end.

### Company and market data

- **FR-04:** Search returns supported canonical companies. **Accept:** Ticker/name search handles ambiguous, unsupported, and empty queries explicitly.
- **FR-05:** Quote/history includes provenance and freshness. **Accept:** Each visible quote has currency and timestamp or explicit provider limitation; delayed/stale/unavailable states differ visually.
- **FR-06:** Historical charts are understandable and accessible. **Accept:** Period, units, axes, and gaps are clear; a text/data-table alternative is available.

### Tracked portfolio

- **FR-07:** Users can add/remove/revisit symbols. **Accept:** The list persists across sessions without requesting share count or purchase price.
- **FR-08:** Individual price performance is shown. **Accept:** Period and comparison basis are stated; missing/stale data is flagged.
- **FR-09:** Collective performance is shown. **Accept:** Method, base date, weighting/rebalancing, currency treatment, and included symbols appear; UI never calls it personal investment return.
- **FR-10:** Sector exposure/concentration is shown. **Accept:** Weighting basis/classification is disclosed; unknown sectors are counted and visible.
- **FR-11:** News/ESG rollups disclose coverage. **Accept:** Reports show article/company counts, window/as-of, aggregation method, and missing coverage.
- **FR-12:** Diversification observations are data-supported. **Accept:** Correlation output shows window and observations; insufficient coverage returns an explicit insufficient-data state.

### Forecasting and news

- **FR-13:** Forecast requests validate ticker, range, horizon, and input history. **Accept:** Invalid dates, unsupported horizons, insufficient history, and provider failures produce specific recoverable errors.
- **FR-14:** Forecast view explains uncertainty and provenance. **Accept:** Actual vs forecast, interval, model/version, horizon, cut-off, and evaluation/baseline or “not available” are shown.
- **FR-15:** Evaluation is reproducible and out of sample. **Accept:** Release evidence records chronological procedure, metrics, baseline, data cut-off, and limitations.
- **FR-16:** News can be filtered by company and time. **Accept:** Each item has source/link/time/association; duplicates are removed within a report.
- **FR-17:** Company report describes coverage and sentiment. **Accept:** Period, article count, analysis method/version, sentiment distribution, and sparse/no coverage are present.
- **FR-18:** Summary attribution and rights are respected. **Accept:** Generated summaries are labeled and linked; full text is displayed only with permission.

### ESG and community

- **FR-19:** ESG panel explains score provenance. **Accept:** Provider, date, scale, pillar values, methodology, and unavailable coverage appear.
- **FR-20:** ESG rollup is auditable. **Accept:** Coverage and aggregation are shown and derived values trace to versioned inputs.
- **FR-21:** Users manage posts. **Accept:** Create/read/edit/delete permissions work; invalid/oversized text is rejected accessibly.
- **FR-22:** Users report content and moderators act. **Accept:** Report target, reporter, timestamp, and status are recorded; authorized moderator actions are audited.
- **FR-23:** Content is safe to render. **Accept:** Script/HTML payloads render inert; attachments, if approved, are constrained and validated.

### Cross-cutting

- **FR-24:** Data panels support loading, partial, empty, stale, and error states. **Accept:** Provider outages do not masquerade as valid zero values or collapse page layout.
- **FR-25:** Core journeys work on mobile and keyboard. **Accept:** Search, tracking, reports, forecast navigation, and posting work at approved mobile widths without horizontal page scroll or keyboard traps.

## 8. Non-functional requirements

### Performance/resilience

- Proposed target: p95 cached dashboard reads under 2 seconds; uncached provider-backed requests under 5 seconds, excluding model jobs.
- Show a loading state promptly; long jobs have progress or bounded timeout/retry behavior.
- Use bounded retries, caching with visible freshness, provider circuit breaking, and graceful degradation.
- Run ingestion/model jobs in managed workers rather than per-web-process startup threads.
- Proposed pilot service objective: 99.5% monthly core-service availability, excluding documented third-party outages.

### Security/privacy

- Keep secrets in protected configuration/secrets management; never log secret values.
- Use secure sessions, modern password hashing, authorization checks, CSRF protections for cookie-authenticated forms, and rate limits.
- Minimize personal data; define consent/notice, retention, deletion, and third-party AI processing.
- Restrict admin actions and audit sensitive operations.
- Review uploads, content rendering, dependencies, and API abuse before launch.

### Accessibility/responsiveness

- Target WCAG 2.2 AA for core journeys, pending formal review.
- Provide keyboard access, visible focus, semantic headings/labels, adequate contrast, and non-color status cues.
- Provide chart summaries/tables and reduced-motion support.
- Support approved mobile, tablet, and desktop widths without overlap or clipped essential controls.

### Data quality/maintainability

- Track provenance, timestamps, currency, coverage, transformations, and version identifiers for market/news/sentiment/ESG/model data.
- Never silently replace missing values with zero or combine incompatible currency/period data.
- Version APIs and validate inputs/outputs.
- Isolate providers behind adapters; use structured logs/metrics without sensitive payloads.
- Maintain automated unit, integration, authorization, end-to-end, and reproducible model-evaluation coverage.

## 9. Core data concepts

- **User:** identity, authentication metadata, status, preferences.
- **TrackedPortfolio:** owner, tracked security references, timestamps; no quantities or cost basis in MVP.
- **Security:** canonical ticker/name, exchange, currency, classification and source.
- **MarketObservation:** price/field, currency, provider, market and ingestion timestamps, adjustment basis.
- **ForecastRun:** security, history window, horizon, model/version, cut-off, forecast/interval, evaluation metadata.
- **NewsArticle:** provider identifier/URL, source/time, linked securities, association rationale, rights state, processing version.
- **NewsAnalysis:** report/article reference, sentiment method/version, summary/themes, generated time.
- **ESGObservation:** security, provider, score/pillars, scale, as-of date, methodology, coverage.
- **CommunityPost/Report:** author, content, company tags, timestamps, moderation/report status.

Define retention/deletion for user data and cached/generated provider data before launch.

## 10. Feature dependencies

1. Company search/profile depends on security master and supported-market scope.
2. Live prices, history, performance, and forecasts depend on provider entitlements and historical data.
3. Group analysis depends on tracked-list persistence, sector classification, price history, and approved formulas.
4. News reports depend on licensed source, company/entity mapping, ingestion/deduplication, and approved summarization/sentiment.
5. Sentiment rollups depend on ticker-level news mapping, time-window, and minimum-coverage policies.
6. ESG insights depend on approved provider, methodology metadata, and coverage rules.
7. Community depends on account identity, safe content handling, reporting, and moderation ownership.
8. All insights depend on provenance, freshness, partial-data behavior, auditability, and monitoring.

## 11. MVP and future enhancements

| Capability | MVP | Future |
|---|---|---|
| Tracked list | One manual list with individual and group analysis | Multiple named portfolios, import/export, alerts |
| Portfolio | Indexed tracked-stock performance, sector/concentration, sentiment/ESG, supported diversification | Actual holdings, transaction returns, tax lots; brokerage sync only as a separate approved initiative |
| Forecast | Historical-data model with uncertainty and validated evaluation | More models, scenarios, alternative/intraday data |
| News | Company filtering, linked reports, sentiment/themes | More sources, multilingual coverage, real-time alerts |
| ESG | Sourced company/pillar data and transparent aggregation | ESG history, custom screens, climate/impact analytics |
| Community | Posts, company tags, basic moderation/reporting | Groups, DMs, reputation tools |
| Chatbot | Excluded | Separate product proposal and evaluation |
| Brokerage | Excluded | Separate strategy, consent, security, and compliance review |
| Notifications | Saved in-product preferences | Email/push alerts |

## 12. MVP release gates

A controlled pilot may start only when:

- Market/news/ESG sources, licenses, supported markets, currencies, and freshness commitments are approved.
- Tracked-basket, sector, concentration, and diversification calculations are defined and disclosed.
- Forecast evaluation is reproducible, out of sample, benchmarked, and meets a founder-approved quality gate—or forecasting is withheld.
- News/ESG methodology, attribution, redistribution, retention, and coverage are approved.
- Privacy, account deletion, moderation, incident response, and support owners are ready.
- Core acceptance criteria pass automated tests and responsive/accessibility review.
- No known critical/high security issue or material disclosure risk remains.
- Qualified counsel reviews claims and obligations for the intended markets.

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Market data delayed, incomplete, costly, or unlicensed | Approve provider/entitlements early; show freshness; use adapter boundary |
| Tracked index mistaken for user return | Avoid holdings/return language; explain no quantities/cost basis; label method |
| Weak forecasts overstated | Require holdout/backtest, baselines, uncertainty, versioning, and restrained language |
| Incorrect news matching/sentiment | Show source links and coverage; evaluate on labeled examples; allow error reports |
| ESG values stale/incomparable | Show provider/date/method/coverage; avoid unsupported rankings |
| Community abuse/misinformation | Assign moderation owner, reporting, removal/escalation workflow |
| Capstone assumptions/secrets/data carried forward | Treat StoCast as reference only; perform security/data-rights review |

## 14. Product measurement

Instrument privacy-conscious events for onboarding, company search/profile, add/remove symbol, portfolio view, news report open, forecast request/result, ESG detail view, post creation/report, and return sessions. Do not send passwords, secrets, raw private content, or unnecessary personal data to analytics.

During pilot, review activation, repeat use, source freshness, provider failures, forecast job success/evaluation, news and ESG coverage, user understanding/trust, and moderation response time.

## 15. Founder decisions and assumptions

Confirmed product direction is treated as fixed. Resolve these remaining decisions before committing dependent design and engineering work.

### P0: before data/API and UX commitments

1. **Market:** launch country/region, exchanges, asset universe, language, currencies, and supported tickers.
2. **Market data:** production provider, licensing/redistribution, real-time vs delayed status, freshness SLA, and cost.
3. **Tracked basket:** approve equal-weight normalized index with daily rebalancing or another formula; decide corporate actions, mixed currencies, holidays, missing data, and minimum coverage.
4. **News:** confirm Yahoo Finance or alternative source, commercial/display rights, full-text access, summary permissions, refresh cadence, and retention.
5. **ESG:** provider/dataset, scale, pillar interpretation, update cadence, and portfolio aggregation.
6. **Forecast:** supported horizons/ranges, model, update policy, backtest procedure, release-quality threshold, and whether forecast ships in first pilot.
7. **Community:** approve comments/reactions/attachments, public vs account-only access, moderator ownership, escalation and response targets.
8. **Legal review:** launch jurisdiction and qualified review of data rights, privacy, generated content, community terms, and product claims.

### P1: before pilot completion

9. **Identity:** email/password, OAuth, verification, recovery, and admin MFA.
10. **Privacy:** deletion completion, event/data retention, analytics opt-out, AI processor disclosure.
11. **Success targets:** approve/revise Section 1 targets and define cohort/window.
12. **Brand:** Aynox tone, visual identity, and explanation of StoCast’s historical relationship.
13. **Notifications:** in-product only or any alert type needed in MVP.
14. **Accessibility/platform:** WCAG target, supported browsers, devices, and minimum mobile width.

### Provisional assumptions

- MVP is a responsive web application; native mobile apps are out of scope.
- Users manually curate symbols; no holdings, transactions, or brokerage access is required.
- Equal-weight normalized basket is a proposal requiring founder approval.
- News reports synthesize and link to articles rather than reproduce them by default.
- Community requires accounts and moderation before public launch.
- Forecast display can be deferred if the validation gate is unmet.
- Provider adapters keep data-source decisions replaceable.

## 16. Repository background and change control

The Aynox repository contains README.md and docs/aynox-startup-roadmap.md, but no separate product specification was present when this PRD was prepared. The roadmap is a working draft whose early customer/feature hypotheses are superseded by the confirmed product direction in this PRD. Its evidence-led principles, model validation, rights review, security, and controlled-pilot guidance remain relevant.

This PRD is the baseline for design and engineering planning. Scope changes involving excluded features, portfolio semantics, data rights, forecast claims, ESG methodology, or user-data handling require founder review and a recorded update. Work should reference the FR identifiers and document approved deviations with rationale.
