# Aynox Identity and Private Watchlist Architecture

**Status:** Architecture proposal. The controlled-pilot account and private-watchlist product scope is approved; provider, session, database-host, and account-lifecycle choices remain open.
**Prepared:** 27 November 2026
**Related open decision:** D-25 in the [Product Decision Register](aynox-product-decisions.md)
**Scope:** Authentication, internal identity, PostgreSQL persistence, private tracked portfolios, demo separation, and account lifecycle. This document proposes implementation boundaries; it does not claim that any of them are implemented.

## 1. Current repository state

The Prisma schema has a `User` model with an optional unique email and relations to `TrackedPortfolio`. A portfolio has a required `userId`; `TrackedPortfolioMembership` stores `securityId`, `effectiveFrom`, and optional `effectiveTo`. PostgreSQL, Prisma, and the PostgreSQL adapter are dependencies, and Prisma has a datasource configuration.

There is no application Prisma client or database access layer, no migration history, and no authentication, session, registration, or private-data API. The only current API route is health. The app’s tracking provider loads and saves event history in browser `localStorage`; fresh browser storage starts with synthetic sample symbols. Static security, news, and market-series data is shared demo content, not account data. Settings describes the demo profile and lack of sign-in accurately.

The current `User` row is therefore a schema placeholder, not an authenticated identity. The presence of `userId` on a portfolio does not by itself enforce ownership.

## 2. Approved controlled-pilot product scope

The product owner has approved that the controlled MVP pilot includes real user accounts and private, account-backed tracked lists:

- Participants must authenticate before using private-watchlist features.
- The private tracked list is persisted server-side. Every read and mutation is authorized using the user’s verified identity; one user must not be able to read or change another user’s list.
- The existing synthetic demo remains available as a separate experience. Browser-local demo tracking is not account data and must not be described as a private watchlist.
- Importing browser-local tracking, if offered, requires explicit user review and approval. It must not happen silently.
- A tracked list represents stocks selected for research and monitoring. It is not a brokerage account, actual holdings, or a personal investment-return record.

This approval sets product scope only. It does not select an authentication provider, database host, registration policy, email-verification or MFA policy, session lifetime, recovery policy, or retention policy. The current repository does not yet implement these approved requirements.

## 3. Recommendation: evaluate managed authentication first

For the first account-backed release, evaluate a managed authentication provider before considering self-managed passwords. Aynox currently has no authentication implementation or operational controls for credential storage, recovery, session revocation, abuse response, or identity incidents. A managed service can reduce that operational burden while the team focuses on product and authorization boundaries.

This is a recommendation about the **approach category**, not approval of a vendor or a connection. Evaluate at least these factors before selection:

| Area | Managed authentication | Self-managed authentication |
|---|---|---|
| Credential security | Provider operates password storage and authentication controls; Aynox still secures integration and sessions. | Aynox owns password hashing, verification, reset tokens, verification mail, credential protection, and incident response. |
| Session lifecycle | Provider SDK/service may manage sessions, rotation, and revocation; exact guarantees must be verified. | Aynox implements storage, expiry, rotation, revocation, secure cookies, and recovery from lost or stolen sessions. |
| Integration | Requires App Router server integration, callback configuration, internal user mapping, and vendor-specific testing. | Avoids vendor dependency but requires a larger security-critical codebase and ongoing specialist review. |
| Operations and cost | Subscription/usage cost, quotas, support tier, vendor availability, and migration/export constraints. | Infrastructure and staff cost for email delivery, abuse prevention, monitoring, on-call response, and security maintenance. |
| Privacy and data location | Review data region, subprocessors, retention, deletion, contract terms, breach notification, and export before selection. | More direct control of storage location, with correspondingly greater responsibility for security and privacy operations. |
| Scalability | Usually provides hosted capacity and established authentication flows; validate limits and pricing. | Scales with Aynox infrastructure and team expertise; capacity and resilience are Aynox’s responsibility. |

Provider selection requires founder approval after engineering, security, deployment, cost, and qualified privacy/legal review. Do not put a provider SDK or credentials into the app before that decision.

## 4. Proposed identity and authorization boundaries

### Stable internal identity

- Keep `User.id` as Aynox’s stable internal identifier. Generate it on the server; do not derive it from an email address or accept it from a browser request.
- Map each external identity by its verified `(issuer, subject)` pair to exactly one internal user. A future `UserIdentity` table is a suitable extension if linking or changing providers must be supported. Enforce uniqueness on `(issuer, subject)` and ensure one external identity cannot silently attach to two internal users.
- Treat email as a contact and verification attribute, not the primary security principal. Decide email normalization, uniqueness, verified-email update, and account-linking rules before schema changes.
- Do not link accounts merely because two providers return the same email. Require an authenticated linking flow or an explicit recovery procedure.

### Trusted session resolution

Create a server-only identity/session adapter. On each protected server request, it must validate the provider session or signed token using the provider’s supported server SDK, validate issuer/audience/expiry and required claims, and map the verified external subject to `User.id`. A client-supplied ID, email, role, or portfolio ID is input only; it never establishes identity or ownership.

Page redirects and middleware can improve navigation, but they are not the authorization boundary. Every Server Action, Route Handler, and data-access function that reads or mutates private data must resolve the trusted user and enforce ownership. Unauthenticated requests should receive a sign-in redirect for page navigation and a consistent `401` response for APIs. Authenticated requests for another user’s portfolio should not reveal whether that portfolio exists; use a consistent not-found response or an explicitly approved `403` policy.

### Session and cookie requirements

Select exact idle and absolute expiry periods with the provider and product owners. Require revocation on logout, credential reset, account deletion, and security-sensitive identity changes; rotate sessions after authentication and privilege changes. Verify provider behavior rather than assuming it.

For any Aynox session cookie, require `HttpOnly`, `Secure` in production, an appropriate `SameSite` policy, narrow path/domain scope, and no JavaScript access. Prefer a host-only cookie and a `__Host-` prefix where compatible. Protect state-changing requests with the provider’s supported CSRF protections plus origin checks where applicable. OAuth-style flows must use supported `state`, nonce, and PKCE validation. Never store session secrets in `localStorage`.

Do not persist provider access tokens unless a documented feature needs them; if needed, define encryption, access, rotation, and deletion controls first.

## 5. Private tracked-portfolio architecture

### Initial product model

Use one private default tracked portfolio per user for the initial account-backed release. It is a research list, not owned assets, a brokerage account, or a personal-return record. Do not add quantities, purchase prices, cost basis, or holdings semantics. The current schema can represent multiple named portfolios, but it does not designate exactly one default portfolio.

The server may locate or create the default portfolio for the authenticated `User.id`. Make creation race-safe with a database uniqueness rule and a transaction. A stable default identifier/flag is more robust than relying only on a user-editable portfolio name. Multi-list support can later add names, ordering, and list-specific settings after a product decision.

### Read and write boundary

Keep database operations in a server-only data-access module. Resolve `User.id` from the trusted session inside the server boundary, then scope every operation by that ID. For example, resolve a portfolio with both its identifier and `userId`; do not fetch by a client-supplied portfolio ID and rely on the UI to hide it. Security selection must also be validated against the supported security catalogue.

Potential API shape, subject to backend design:

- `GET /api/watchlist` — read the current user’s default list and membership state.
- `POST /api/watchlist/memberships` — add a supported security.
- `DELETE /api/watchlist/memberships/{securityId}` — remove a current member.
- Optional export/import endpoints only after their product and privacy requirements are approved.

These are proposals, not existing routes. Do not accept `userId` or an authoritative membership timestamp from the client. Validate request size, symbol/security identifiers, content type, and operation frequency. Apply request-origin/CSRF protections to mutations.

### Transaction and interval invariants

Preserve the approved membership-history semantics in D-09 and the existing financial methodology. For ordinary operations, use server UTC timestamps and translate them to the already-approved calculation-interval rules; do not change financial formulas in this workstream.

- **Add:** in a transaction, confirm ownership, confirm the security is supported, and check for an active membership. If already active, return an idempotent success. Otherwise insert one new open interval.
- **Remove:** in a transaction, locate the owned portfolio’s open membership and close it once at the server timestamp. If no active membership exists, return an idempotent result without inventing a second event.
- **Concurrency:** serialize mutations for a portfolio or use an equivalent concurrency-safe approach. Handle duplicate-key conflicts as a normal race, then re-read the state.
- **Database integrity:** preserve unique membership identities. Add a database rule preventing more than one open membership for a `(portfolioId, securityId)`, and a check that a closed interval ends after it begins. Prevent overlapping historical intervals as well, using a PostgreSQL exclusion constraint if supported in the chosen deployment, or a transaction/locking design with demonstrated race tests. Prisma may require custom SQL migrations for partial/exclusion constraints.
- **History:** preserve old intervals after removal. Never reconstruct historical composition from the current list. Audit the interval representation against the approved boundary semantics before migrating calculations to persisted records.

Every query and mutation must be tested for cross-user isolation, including direct calls that bypass UI navigation.

## 6. Keep demo mode separate; make import optional

Keep the current localStorage-based synthetic demo functional during rollout. Demo state remains browser-local and never becomes an account-owned list without a deliberate user action. Authenticated watchlist data is server-backed and owner-scoped. Clearly label which mode is active and avoid silently merging the two.

If founders approve local-list import:

1. Ask the authenticated user to explicitly review and approve an import; show the validated symbols and explain that data comes from this browser.
2. Accept only a bounded payload and supported security identifiers. Normalize and validate symbols against the server’s supported catalogue; reject unknown or ambiguous mappings.
3. Treat all browser data—including IDs, event types, and timestamps—as untrusted. Do not use imported timestamps as verified historical membership evidence or feed them into historical performance reconstruction.
4. Import the **current active symbol set** at the server’s import time. For a legacy symbol-only list, state honestly that tracking begins at import time; do not manufacture earlier membership history. For the v2 local event log, do not treat its client timestamps as authoritative; import only current membership unless a separate, explicitly labeled user-provided-history feature is approved.
5. Perform the import transactionally and make retries idempotent. If it fails, keep the browser demo list unchanged and report that account import did not complete.
6. Do not delete local data automatically after import. If a later product flow offers deletion, require a clear separate action and explain the consequence.

This approach preserves demo use and avoids representing editable browser history as verified server history.

## 7. Account lifecycle and privacy requirements

| Lifecycle area | Product decision required | Implementation requirement |
|---|---|---|
| Registration | Open, invite-only, or pilot enrollment; supported regions/ages if applicable. | Validate and rate-limit creation; prevent identity duplication; show clear notices before account creation. |
| Email verification | Whether required and when access is granted. | Use expiring single-use verification through the selected provider; do not treat an unverified address as verified identity. |
| Sign-in/logout | Supported methods, remembered sessions, and shared-device expectations. | Generic failure messages to reduce enumeration; revoke sessions on logout; avoid persistent authentication in browser storage. |
| Recovery | Recovery factors, support escalation, and recovery proof. | Use provider-supported expiring, single-use flows; rate-limit requests; do not reveal whether an address is registered. |
| Account settings | Editable email/name, linked identities, language, and session list. | Require reauthentication or verification for sensitive changes; show current account identity clearly. |
| Data export | Whether users can export account and watchlist data, and in which formats. | Export only data owned by the authenticated user; scope every query; provide an authenticated download with limited lifetime. |
| Watchlist deletion | Whether deleting a list is immediate or recoverable. | Delete only owner-scoped data; apply approved cascade/retention behavior; confirm the target list in the UI. |
| Account deletion | Immediate deletion, recovery grace period, and treatment of security/operational logs. | Revoke sessions, make the account unavailable promptly, cascade/delete or de-identify owned data according to the approved policy, and retain only specifically approved records. |
| Retention | Account inactivity, backups, logs, and support records. | Define retention windows, backup expiry, and deletion verification; do not promise deletion from backups until the process supports it. |
| Privacy notices/consent | Analytics, optional communications, notices, and data-region disclosure. | Collect only approved data; keep optional choices distinct; record required consent/version evidence where the approved policy calls for it. |

Privacy/legal obligations, notices, lawful basis, international transfer terms, age requirements, and retention periods require qualified review for the actual deployment and audience. This proposal makes no legal-compliance claim.

## 8. Responsibilities and dependencies

| Work area | Frontend | Backend/database | Identity/security | Deployment/privacy |
|---|---|---|---|---|
| Registration/sign-in | Build localized accessible screens, states, and validation feedback after flows are approved. | Implement server callback/route integration only as required by the chosen provider. | Configure provider policies, redirect allowlists, verification/recovery, MFA decision, and abuse controls. | Secure provider secrets, set production origins/domains, review data region and contractual terms. |
| Session | Show authenticated state and logout; never decide ownership client-side. | Resolve trusted principal server-side and expose only minimum session state. | Review expiry, rotation, revocation, cookie flags, CSRF, and account linking. | Separate dev/staging/prod domains and secrets; monitor auth errors and incidents. |
| Watchlist | Read/write only through authenticated server operations; keep demo mode explicitly separate. | Create Prisma client/repository, migrations, scoped queries, transactions, constraints, and export/deletion operations. | Review IDOR/cross-user tests, rate limits, audit/log redaction, and concurrency. | Provision PostgreSQL, backups/restore, least-privilege credentials, migration process, and monitoring. |
| Privacy/lifecycle | Explain local demo vs account data, import consent, export/delete controls, and status. | Implement owner-scoped export/delete and retention jobs as approved. | Review data minimization, session revocation, logs, and deletion evidence. | Approve privacy notices/retention with qualified review; define support and incident ownership. |

The product scope for authenticated accounts and private watchlists in the controlled pilot is approved. Implementation still depends on resolving the open provider evaluation, registration, verification/MFA, session and recovery expectations, one-list default, import behavior, and deletion/retention policy. The backend team must also confirm the PostgreSQL environment, migration owner, deployment region, operational support, and recovery capability.

## 9. Product decisions awaiting approval

These remain open; the approved controlled-pilot account/private-watchlist scope does not decide them:

1. Managed-auth approach and eventual vendor, subject to security/privacy/cost evaluation.
2. Registration policy, pilot eligibility, email verification, and whether MFA is required or available.
3. Session lifetime, remembered-device behavior, provider token handling, and revocation expectations.
4. One default watchlist for initial accounts; whether multi-list support is later required.
5. Optional local import behavior and whether imported symbols start only at the server import timestamp.
6. Email identity normalization, account linking, recovery and support process.
7. Account/watchlist deletion timing, retention periods, backup expiry, and export format.
8. Analytics/communications consent, privacy notice, data region, and qualified local privacy/legal review.
9. Backend owner, database hosting owner, migration approval/release process, and incident response owner.

Record each decision in D-25 with an owner, approver, evidence, date, and revisit trigger. Update the PRD/roadmap only after approval; do not convert this recommendation into a confirmed product decision by implementation.

## 10. Backend-team handoff

### Approved product requirements

- Controlled-pilot participants must authenticate to use private-watchlist functionality.
- Each private tracked list is persisted server-side and every read/write is authorized against the user’s verified identity. Cross-user access is prohibited.
- Keep synthetic browser-local demo tracking separate. Import, if built, requires explicit user approval.
- Tracked lists are for research and monitoring, not brokerage holdings, account balances, or personal returns.

### Backend-team responsibilities and unresolved technical decisions

1. **Trusted identity:** Select and integrate an approved authentication approach only after evaluation. Resolve a verified external `(issuer, subject)` to one stable internal `User.id`; do not derive identity from email or accept user/owner IDs from clients. Decide identity-linking and normalization rules.
2. **Session verification:** Implement server-side session/token verification on every private request and map the verified identity to the internal user. Define expiry, revocation, cookie/CSRF protections, and failure behavior with security review; no session policy is approved yet.
3. **Owner-scoped operations:** Provide server-only watchlist read/write operations. Derive owner identity from the verified session and scope every query/mutation by internal user ownership. Do not rely on middleware or client-side visibility for authorization.
4. **Database and migrations:** Confirm PostgreSQL host/region, provisioning owner, Prisma client boundary, migration author/reviewer/approver, deployment procedure, backup/restore, and operational support. These owners and the database host are not approved.
5. **Membership integrity and concurrency:** Preserve D-09 effective membership history and its exchange-calendar boundary requirements. Make add/remove transactional and idempotent; prevent duplicate open or overlapping membership intervals under concurrent requests using database constraints and/or a demonstrated concurrency-safe strategy. Do not change portfolio formulas or imply actual holdings.
6. **Optional import:** If product later approves import, require explicit user confirmation; validate bounded client data against supported securities; treat client IDs/timestamps as untrusted; start imported active symbols at server import time; make retries idempotent; preserve the local demo data.
7. **Account lifecycle:** Implement owner-scoped export and deletion only against approved policy. Define session revocation, account/list deletion behavior, retention of logs/backups/provider records, and deletion verification with product, operations, security, and qualified privacy/legal input. None of those policies is approved.
8. **Security acceptance:** Add tests proving unauthenticated denial and user-A/user-B read/write isolation, including substituted IDs and direct server-operation calls; cover session expiry/revocation, ownership checks, interval races, import replay/validation, and lifecycle authorization as applicable.

The requirements above are product-approved; the integration pattern, provider, schema/migration details, and proposed defaults remain technical proposals until the backend, security, and product owners review them. No backend-team approval is implied by this handoff.

## 11. Staged implementation and security acceptance

1. **Approve requirements and ownership:** resolve the decisions above; name frontend, backend, identity, deployment, and privacy owners.
2. **Choose and evaluate the identity approach:** complete provider/security/privacy/cost review; keep credentials out of source and browser code.
3. **Prepare persistence:** establish PostgreSQL environments, Prisma client boundary, reviewed migrations, backup/restore process, and interval constraints.
4. **Implement internal identity mapping:** create or link one internal `User.id` from a validated external `(issuer, subject)`; test uniqueness and safe linking.
5. **Implement sessions and account flows:** verification, sign-in/out, recovery, rotation/revocation, cookie protections, rate limits, and generic errors.
6. **Implement owner-scoped watchlists:** one default list, server-only DAL, authenticated reads/writes, transactional interval maintenance, and deletion/export policy.
7. **Add optional import and keep demo mode:** consent, validation, safe retry, server-time membership start, and no automatic local deletion.
8. **Security acceptance before pilot:** demonstrate that unauthenticated requests cannot read/write private data; user A cannot access user B’s records even when IDs are substituted; all ownership is server-derived; concurrent add/remove cannot create duplicate/open overlapping intervals; cookies/CSRF/session expiry/revocation behave as approved; account recovery does not enumerate users; rate limits work; deletion/export are owner-scoped and auditable; and the local synthetic demo still works without authentication.

## Related documents

- [Aynox Product Decision Register](aynox-product-decisions.md)
- [Aynox MVP Product Requirements Document](aynox-mvp-prd.md)
- [Aynox Startup Roadmap](../aynox-startup-roadmap.md)
