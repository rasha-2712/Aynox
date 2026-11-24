# Aynox Startup Roadmap

**Status:** Working draft  
**Purpose:** Turn the current startup plan into an evidence-led sequence of work.  
**Naming note:** The project was previously called *Stocast* and is now named *Aynox*. Use *Aynox* in current materials; retain *Stocast* only when referring to the former name or historical capstone materials.

## Working product hypothesis

The current hypothesis is that Stocast helps a defined group of investors or financial researchers make better-informed decisions using stock forecasts, market insights, historical data, and ESG analysis. The capstone materials should be reviewed to confirm what the existing prototype actually does and what evidence supports its claims. Until then, features and performance are hypotheses, not validated product capabilities.

## Roadmap principles

1. Choose one initial customer group and one high-value use case before expanding features.
2. Collect evidence before committing to pricing, broad launch, or significant infrastructure spend.
3. Treat forecast quality, data rights, user trust, and regulatory review as product work, not late-stage paperwork.
4. Keep the MVP small enough to evaluate with real users.
5. Do not present forecasts as guaranteed outcomes or personalized financial advice without qualified review of the product and its claims.

## Roles and ownership

These are proposed owners based on the team roles in the source plan. Confirm with the co-founders and add dates in the tracker.

| Role | Proposed owner | Accountable for |
|---|---|---|
| CEO | Shaza | Customer segment, product direction, partnerships, funding narrative, go/no-go decisions |
| COO | Rasha | Interview operations, pilot coordination, documentation, business model and operating assumptions |
| CTO | Sara | Prototype review, forecast evaluation, architecture, security, data-source feasibility |
| All co-founders | All | Customer interviews, reviewing evidence, and approving major scope changes |

## Phases and exit criteria

### Phase 0 — Recover the current state

**Goal:** Establish what already exists before planning new development.

**Work**
- Review the defense report, research paper, prototype, source repository, and any demo materials.
- Inventory working features, incomplete features, data sources, model inputs/outputs, and known limitations.
- Record what was tested, on what data, over what period, and against which baselines.
- Identify any credentials, private data, or licensed datasets in the repository and remove exposed secrets through the appropriate rotation process.

**Deliverables**
- Product and prototype inventory.
- Evidence table separating demonstrated results from assumptions.
- List of open technical, data, and compliance questions.

**Exit criteria**
- The team can demonstrate the current prototype and explain its data flow.
- Forecast and ESG claims have traceable evidence or are explicitly marked unvalidated.
- A single list of known gaps and owners exists.

### Phase 1 — Select the first customer and problem

**Goal:** Find a specific problem worth solving for an identifiable first customer group.

**Work**
- Write 2–3 candidate customer/problem statements, such as retail investors seeking research support or analysts screening listed companies. Do not assume these groups have the same needs.
- Interview 10–15 people across the strongest candidate group(s). Ask about their recent behavior and existing tools before describing Stocast.
- Capture current workflow, pain frequency, consequences, alternatives, trust requirements, and willingness to trial or pay.
- Identify Qatar-specific and regional customer access through the capstone and practicum networks.

**Deliverables**
- Interview guide and anonymized notes.
- Customer/problem summary with evidence and counter-evidence.
- Chosen initial segment and rejected alternatives, with reasons.

**Exit criteria**
- At least one repeated, concrete problem appears across interviews.
- The chosen group is reachable for a pilot.
- The team can state who the user is, what task they need to complete, and why current options fall short.

### Phase 2 — Define the MVP and test the value proposition

**Goal:** Test whether the existing product direction is useful before broadening scope.

**Work**
- Create a one-page concept/landing page and a short product demo using only claims supported by evidence.
- Show the prototype to 5–8 target users and observe them completing a defined task.
- Test one narrow workflow. Candidate: choose a supported stock, view a forecast with uncertainty and explanation, inspect historical performance, and save it to a watchlist.
- Defer community features, a paid chatbot, and trading unless user research shows they are essential to the first use case.

**Deliverables**
- MVP scope and out-of-scope list.
- Usability findings and revised value proposition.
- Pilot interest list, with explicit permission to follow up.

**Exit criteria**
- Users can complete the core task with limited assistance.
- Feedback identifies a clear improvement to decision support or research workflow.
- At least 3 qualified users agree to discuss or participate in a pilot (adjust this threshold if the reachable market is small).

### Phase 3 — Validate forecast quality, data, and trust

**Goal:** Establish what the model can and cannot responsibly claim.

**Work**
- Define forecast target, horizon, supported assets, update cadence, and intended use.
- Evaluate against simple baselines and relevant market benchmarks using a time-based holdout; avoid leakage from future data.
- Report more than one metric, include uncertainty and failure cases, and segment results where relevant (for example, by horizon or market conditions).
- Evaluate ESG source coverage, date, provenance, and disagreement. Clearly distinguish source facts from model-generated summaries.
- Confirm provider terms allow the intended display, storage, derived data, and commercial use for each market-data and ESG source.
- Document stale-data behavior, missing-data behavior, and how corrections are handled.

**Deliverables**
- Model evaluation note with methodology, baselines, results, and limitations.
- Data-source register with owner, rights, cost, coverage, and refresh expectations.
- User-facing explanation of forecast uncertainty and data provenance.

**Exit criteria**
- The team can explain performance relative to a baseline without implying guaranteed returns.
- Required data can be used for the intended pilot under documented terms.
- Material limitations are visible to pilot users.

### Phase 4 — Run a small, controlled pilot

**Goal:** Observe repeated use and value in a real workflow.

**Work**
- Recruit 5–10 users from the selected segment for a 3–4 week pilot.
- Agree on pilot scope, success measures, support channel, and feedback cadence.
- Use a limited set of supported instruments and avoid taking custody of funds or placing trades.
- Track activation, completion of the core workflow, repeat use, trust/understanding, and qualitative feedback.
- Ask for a concrete next commitment at the end: continue testing, introduce a buyer, or discuss a paid pilot.

**Deliverables**
- Pilot plan and participant consent/notice.
- Weekly usage and issue log.
- Pilot findings and go/no-go recommendation.

**Exit criteria**
- Users return to the product for the target job during the pilot.
- Critical trust, data quality, or usability issues are resolved or have a credible mitigation.
- At least 2 users provide a concrete continuation signal (for example, repeat use, referral to a decision-maker, or paid-pilot discussion).

### Phase 5 — Choose the business model and pricing

**Goal:** Select a model that matches the buyer, value, and cost to serve.

**Work**
- Compare freemium subscription, B2B licensing, enterprise contracts, and other models against actual customer interviews and pilot behavior.
- Estimate per-user costs for market data, AI inference, hosting, support, and payment processing.
- Test price ranges in conversations; distinguish stated interest from actual purchase intent.
- Define plan limits only after cost and usage patterns are understood. Treat proposed forecast counts and watchlist caps as testable hypotheses.

**Deliverables**
- Business Model Canvas.
- Pricing hypotheses and evidence log.
- Simple 12-month cost/revenue scenarios with assumptions and sensitivity ranges.

**Exit criteria**
- A specific payer and buying path are identified.
- Proposed pricing can cover plausible cost to serve at target usage, or a funding rationale explains the gap.
- Free-tier limits do not make the core value impossible to evaluate.

### Phase 6 — Prepare for a responsible public launch

**Goal:** Make the service supportable, secure, and ready for a limited release.

**Work**
- Choose hosting, authentication, database, and observability based on the actual application architecture and team skills. Managed services can reduce infrastructure work but do not replace secure application and data-permission design.
- Keep secrets on the server, use least-privilege access, enable MFA for administrators, and establish environment separation.
- Set up dependency alerts, error monitoring, rate limits for sensitive endpoints, backups, and a tested restore procedure.
- Define retention and deletion practices for account and usage data; collect only what is needed.
- Obtain qualified local advice on product classification, marketing claims, disclaimers, privacy obligations, and any approvals relevant to the target markets.
- Create a support and incident response checklist, and identify who handles user reports and data issues.

**Deliverables**
- Launch readiness checklist and system/data-flow diagram.
- Privacy notice and product limitations reviewed for the intended market.
- Backup/restore record and incident contact/response plan.
- Security review of the deployed MVP; schedule independent assessment if the risk profile warrants it.

**Exit criteria**
- No known critical security issue remains open.
- Recovery from backup has been demonstrated.
- The team can respond to a user report, stale data, or service outage.
- Required data rights and launch claims have been reviewed.

### Phase 7 — Incubation, funding, and growth

**Goal:** Use validated evidence to seek support and expand deliberately.

**Work**
- Approach UHub and QSTP with the customer problem, prototype evidence, pilot results, team roles, and realistic cost assumptions.
- Build the pitch deck and business proposal from validated findings rather than market-size claims alone.
- Publish social accounts only when there is a clear audience, useful content cadence, and approved claims.
- Expand customer segments, stock coverage, or markets one at a time and re-check data rights and performance.

**Deliverables**
- Evidence-backed pitch deck and proposal.
- Incubator application tracker and follow-up plan.
- Quarterly product and market review.

**Exit criteria**
- The next growth investment has a measurable objective and an owner.
- Expansion decisions are supported by usage, retention, customer demand, and operating economics.

## Future ideas (not MVP commitments)

- Internship contracts and forms: handle as a separate operations/legal workstream with appropriate review.
- Social media: begin after the target audience and evidence-backed messaging are clear.
- Trading platform: treat as a separate product strategy decision. It introduces materially different regulatory, security, operational, and customer-support requirements.

## Initial risk register

| Risk | Why it matters | Early response | Owner |
|---|---|---|---|
| Weak or unproven forecast performance | Damages trust and makes product claims unreliable | Benchmark with time-based evaluation and show uncertainty | CTO |
| Market/ESG data rights or changing costs | Can block launch or make the business uneconomic | Confirm commercial terms and model per-user costs early | CTO + COO |
| Unclear customer or buyer | Leads to feature sprawl and weak sales | Pick one initial segment and interview before building | CEO + COO |
| Users interpret forecasts as guarantees | Creates trust and potential compliance exposure | Use careful wording, limitations, uncertainty, and qualified review | CEO + CTO |
| Sensitive data or exposed credentials | Could harm users and disrupt operations | Minimize collection, secure secrets, least privilege, MFA, backups | CTO |
| AI/API usage cost grows faster than revenue | Freemium use may become expensive | Measure cost per workflow and set limits from evidence | CTO + COO |

## First 30 days

| Week | Focus | Outputs |
|---|---|---|
| 1 | Recover project state | Prototype inventory, report findings, open-question list |
| 2 | Customer discovery | Interview guide, first 5–8 interviews, customer/problem candidates |
| 3 | Prototype evaluation | Demo sessions, usability findings, model/data questions |
| 4 | Decide pilot scope | Chosen segment, MVP scope, pilot measures, go/no-go review |

The schedule is a starting point. Move dates based on team availability and customer access; preserve the phase exit criteria.

## Team decision log

Record major decisions here, including the date, evidence considered, decision owner, and revisit trigger.

| Date | Decision | Evidence | Owner | Revisit when |
|---|---|---|---|---|
| TBD | Select initial customer segment | TBD | CEO | After discovery interviews |
| TBD | Select MVP workflow | TBD | All co-founders | After prototype sessions |
| TBD | Select hosting/auth/data providers | TBD | CTO | After architecture and data-rights review |
