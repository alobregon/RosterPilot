# Fantasy GM — Staged Implementation Plan

**Status:** Draft v0.1  
**Date:** 2026-08-10  
**Companion document:** `ARCHITECTURE.md`

---

## 1. Objective

Build an MVP that allows a user to manage a Yahoo fantasy football team through natural-language conversation.

The canonical acceptance scenario is:

> Submit a waiver claim for Cam Skattebo with $30 FAAB, dropping Rachaad White.

The application must turn that instruction into a validated, user-approved, provider-verified fantasy transaction.

---

# Phase 0 — Project Bootstrap

## Goal

Create a production-shaped repository without overbuilding infrastructure.

## Tasks

### Repository

Create monorepo:

```text
apps/mobile
apps/web
apps/api
packages/agent
packages/domain
packages/provider-core
packages/provider-yahoo
packages/transaction-engine
packages/validation
packages/database
packages/shared-types
packages/test-fixtures
docs/yahoo-spike
```

### Tooling

Configure:

- TypeScript;
- ESLint;
- Prettier;
- Vitest;
- package workspaces;
- environment validation;
- Docker Compose for local PostgreSQL + Redis;
- database migrations;
- CI.

### Backend skeleton

Implement:

```text
GET /health
GET /ready
```

### Database

Create initial migrations for:

```text
users
provider_accounts
provider_tokens
fantasy_leagues
fantasy_teams
players
provider_players
```

## Exit criteria

- Repository installs cleanly.
- CI runs tests and lint.
- API boots locally.
- PostgreSQL migrations run from zero.
- Redis is reachable.
- Secrets are not committed.

---

# Phase 1 — Gate 0: Yahoo Feasibility Spike

## Goal

Determine whether Yahoo can support the required product through currently supported integration mechanisms.

**Do not build the complete app before this phase is resolved.**

## Workstream A — Developer application

Create a Yahoo developer application.

Document:

```text
client ID
redirect URI requirements
required permissions/scopes
authorization endpoint
token endpoint
token lifetime
refresh behavior
revocation behavior
```

Secrets must be stored in local environment/secrets management, never in source control.

## Workstream B — OAuth

Implement:

```text
GET /v1/providers/yahoo/connect
GET /v1/providers/yahoo/callback
```

Flow:

```text
Fantasy GM
   ↓
Yahoo authorization
   ↓
callback with authorization code
   ↓
exchange code
   ↓
store encrypted refresh/access token
```

Tests:

- invalid state rejected;
- callback replay rejected;
- revoked token handled;
- token refresh works.

## Workstream C — Read APIs

Against a real disposable account/league, retrieve:

- user identity where supported;
- games;
- football leagues;
- selected league;
- team;
- roster;
- league settings;
- player data;
- waiver/free-agent state if available;
- transaction history if available.

Store raw fixtures from successful responses after removing credentials and personal information.

## Workstream D — Write feasibility

Determine the currently supported mechanism for:

1. lineup change;
2. add/drop;
3. waiver claim;
4. waiver claim with FAAB.

For each:

```text
endpoint / method
payload
authorization
success response
failure response
provider documentation
provider terms
verification strategy
```

Execute only inside a disposable league.

## Deliverable

Create:

```text
docs/yahoo-spike/RESULTS.md
```

with one of:

### GO

Yahoo writes are supported and repeatable.

Proceed to full transactional MVP.

### ADVISOR-FIRST

Read access works but supported write access cannot be established.

Proceed with AI Advisor MVP while researching provider alternatives.

### NO-GO

Required access is unavailable or would require an unsupported/unsafe integration.

Do not make browser automation a hidden production dependency.

## Exit criteria

A written, reproducible conclusion exists.

---

# Phase 2 — Domain and Provider Layer

## Goal

Remove Yahoo-specific behavior from the rest of the application.

## Implement normalized models

```ts
FantasyLeague
FantasyTeam
FantasyPlayer
RosterPlayer
PlayerAvailability
WaiverRules
RosterRules
ScoringSettings
ProviderTransaction
```

## Implement provider interface

Create:

```ts
FantasyProvider
```

with read operations plus transaction validation/submission.

## Implement Yahoo adapter

`packages/provider-yahoo`

Responsibilities:

- provider authentication;
- Yahoo IDs;
- transport;
- pagination;
- Yahoo request/response conversion;
- normalized errors;
- rate-limit handling;
- transaction submission if Gate 0 is GO.

## Provider errors

Normalize failures:

```ts
ProviderAuthError
ProviderRateLimitError
ProviderUnavailableError
ProviderValidationError
ProviderTransactionError
ProviderUnsupportedOperationError
```

## Contract tests

Create a provider contract suite.

The Yahoo adapter must pass the same contract expected of future providers.

## Exit criteria

The API can return normalized:

```text
my leagues
my league
my team
my roster
player search
availability
transactions
```

without Yahoo-shaped objects reaching client code.

---

# Phase 3 — User Accounts and Yahoo Connection UX

## Goal

A user can create an app account and connect Yahoo.

## Backend

Implement:

```text
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/logout

GET  /v1/provider-accounts
POST /v1/providers/yahoo/connect
GET  /v1/providers/yahoo/callback
DELETE /v1/provider-accounts/:id
```

## Mobile

Screens:

```text
Welcome
Create account / Sign in
Connect Yahoo
Choose league
Syncing
Home
```

## Security

- encrypted refresh tokens;
- object ownership checks;
- OAuth state;
- CSRF controls as appropriate;
- secure cookies/tokens;
- request rate limiting.

## Exit criteria

A new user can:

```text
install app
→ sign in
→ connect Yahoo
→ select league
→ see team name
→ see roster
```

---

# Phase 4 — Read-Only AI Advisor

## Goal

Build useful AI behavior before allowing mutations.

## Agent setup

Create `FantasyGMAgent`.

Initial tools:

```text
get_my_leagues
get_league_settings
get_my_team
get_roster
search_players
get_player_availability
get_free_agents
get_waiver_players
get_recent_transactions
get_faab_balance
```

## Agent rules

System instructions should require:

- tool use for current fantasy state;
- no fabrication of provider facts;
- no execution of mutations;
- clarification when player resolution is ambiguous;
- explicit distinction between recommendation and transaction.

## Conversation persistence

Database:

```text
conversations
conversation_messages
```

Add sessions or conversation state.

## API

```text
POST /v1/conversations
POST /v1/conversations/:id/messages
GET  /v1/conversations/:id
```

Stream responses.

## Evaluation set

At minimum:

```text
"Who is on my roster?"
"Who is my weakest RB?"
"Who should I start at flex?"
"Find the best RB on waivers."
"How much FAAB do I have?"
"Who would you drop for Cam Skattebo?"
"Can I afford a $35 claim?"
```

## Exit criteria

The agent answers roster-specific questions using actual league data and never invents an action result.

---

# Phase 5 — Player Resolution Engine

## Goal

Make conversational player references safe enough for transactions.

## Implement

```ts
resolvePlayerReference({
  text,
  conversationContext,
  roster,
  leaguePlayers
})
```

Priority:

1. exact conversation referent;
2. exact roster full name;
3. unique roster surname;
4. exact league full name;
5. candidate list;
6. clarification.

## Examples

### Input

> Drop White.

If only Rachaad White is on roster:

```text
resolved → Rachaad White
```

If multiple White players are plausible:

```text
resolution → ambiguous
```

### Input

> Bid $20 on the second guy.

Resolve from the immediately preceding recommendation list.

## Tests

Cover:

- nicknames;
- surnames;
- duplicate surnames;
- misspellings;
- pronouns;
- "him";
- "that guy";
- ordinal references;
- prior-turn references.

## Exit criteria

Write actions cannot proceed with ambiguous player identity.

---

# Phase 6 — Transaction Engine

## Goal

Build transaction creation, validation, approval, execution, and verification as deterministic backend behavior.

## Tables

Add:

```text
proposed_transactions
transaction_approvals
provider_transactions
audit_events
```

## Implement state machine

```text
DRAFT
VALIDATING
INVALID
PROPOSED
REJECTED
APPROVED
SUBMITTING
SUBMITTED
VERIFYING
VERIFIED
FAILED
VERIFICATION_FAILED
```

## Proposal API

```text
POST /v1/transactions/propose
```

## Approval API

```text
POST /v1/transactions/:id/approve
POST /v1/transactions/:id/reject
```

## Execution API

```text
POST /v1/transactions/:id/execute
```

Execution requirements:

- only approved transaction;
- approval belongs to requesting user;
- payload hash exactly matches approval;
- transaction not expired;
- transaction not previously executed;
- revalidate provider state;
- submit with idempotency protection;
- verify provider state.

## First transaction type

Implement only:

```text
WAIVER_CLAIM
```

Payload:

```ts
interface WaiverClaimPayload {
  addPlayerId: string;
  dropPlayerId?: string;
  faab: number;
}
```

## Validation

Check:

```text
player identity
availability
ownership
FAAB
roster legality
league legality
duplicate claim
transaction lock
```

## Exit criteria

A hard-coded waiver proposal can be approved and safely executed through the provider adapter.

---

# Phase 7 — AI Transaction Preparation

## Goal

Connect natural language to the deterministic transaction engine.

## New agent tool

```text
prepare_waiver_claim
```

Arguments:

```ts
{
  leagueId: string;
  addPlayerId: string;
  dropPlayerId?: string;
  faab: number;
}
```

The tool:

1. calls transaction proposal service;
2. does not submit;
3. returns proposal ID and normalized summary.

## Example

User:

> Submit waiver claim for Cam Skattebo with 30 FAAB, dropping Rachaad White.

Agent flow:

```text
search Cam Skattebo
search Rachaad White
get roster
get availability
get FAAB
prepare_waiver_claim
```

Response renders:

```text
WAIVER CLAIM

Add: Cam Skattebo
Drop: Rachaad White
Bid: $30
Current FAAB: $77
Remaining if successful: $47

[Confirm]
[Cancel]
```

## Approval behavior

The model must not interpret:

> Yes

as permission to execute an arbitrary newly constructed transaction.

The UI/backend approval must reference the exact persisted proposal ID.

## Exit criteria

The canonical natural-language command produces the exact expected proposal.

---

# Phase 8 — Waiver Execution MVP

## Goal

Complete the first end-to-end production scenario.

## Workflow

```text
User message
→ agent tool calls
→ proposal
→ validation
→ approval card
→ user confirms
→ provider submit
→ provider verify
→ activity record
→ result message
```

## Result states

### Submitted / pending

> Your $30 claim for Cam Skattebo, dropping Rachaad White, has been submitted and is pending Yahoo waiver processing.

### Invalid

> The claim wasn't submitted because you have only $22 FAAB remaining.

### Provider failure

> Yahoo rejected the request. No roster change was made.

### Verification uncertain

> The request was sent, but I couldn't verify the claim in Yahoo. I have not marked it successful.

## Exit criteria

The canonical scenario passes against the disposable Yahoo league and is repeatable.

---

# Phase 9 — Add/Drop and Lineup Moves

## Goal

Expand from waiver claims to the other highest-value actions.

## Add transaction types

```text
ADD_DROP
LINEUP_CHANGE
```

## Tools

```text
prepare_add_drop
prepare_lineup_change
```

## Example commands

```text
"Add Player X and drop Player Y."
"Put Player X in my flex."
"Bench Player X and start Player Y."
"Optimize my lineup, then show me the changes."
```

For "optimize", the agent may propose multiple changes but must present the final exact set for approval.

## Exit criteria

All supported MVP write actions use the same transaction engine and approval system.

---

# Phase 10 — Mobile Product Polish

## Goal

Turn the working engineering system into a usable MVP.

## Chat UI

Support cards:

- player recommendation;
- waiver recommendation;
- transaction proposal;
- transaction pending;
- transaction completed;
- transaction failed.

## Roster UI

Display:

```text
Starters
Bench
IR
FAAB
```

Tap player → open player context/chat.

Example:

```text
"Ask Fantasy GM about this player"
```

## Activity UI

Show:

```text
recommendations
approved actions
rejected actions
provider transactions
errors
```

## Settings

```text
Yahoo connection
selected league
manager preferences
notifications
privacy
delete account
```

## Exit criteria

A user can complete all MVP workflows without developer tools.

---

# Phase 11 — Manager Preferences

## Goal

Make recommendations personal rather than generic.

## Preferences

Examples:

```text
waiver aggressiveness
risk preference
bench upside vs floor
minimum FAAB reserve
trade aggressiveness
favorite players
avoid-list
```

## Rules

Preferences affect recommendations.

Preferences never override:

- provider rules;
- roster rules;
- transaction limits;
- approval requirements.

## Example

User preference:

> Keep at least $25 FAAB unless it's a league-winning move.

If the agent recommends $30 while the user has $45:

> That would leave $15, below your preferred $25 reserve. I'd normally cap the bid at $20 unless you want to override your preference.

## Exit criteria

Preferences persist and affect future recommendations.

---

# Phase 12 — Notifications

## Goal

Add proactive value without autonomous roster mutation.

Initial notifications:

- waiver result;
- Yahoo connection expired;
- pending transaction failure;
- player status change relevant to current lineup;
- upcoming lineup lock.

Do not automatically execute actions.

Example:

```text
Rachaad White is now OUT.
You currently have him starting.

Fantasy GM recommends:
White → Bench
Player X → FLEX

[Review change]
```

## Exit criteria

Notifications deep-link into the relevant Fantasy GM conversation/action.

---

# Phase 13 — Production Hardening

## Security review

Verify:

- provider token encryption;
- account deletion;
- secrets management;
- authorization boundaries;
- rate limiting;
- injection-resistant tool design;
- audit log completeness;
- log redaction;
- privacy policy requirements;
- provider terms.

## Reliability

Add:

- retry policies;
- provider circuit breaker;
- queue dead-letter handling;
- idempotency tests;
- transaction reconciliation job;
- token refresh monitoring.

## Observability

Dashboards:

```text
API error rate
agent error rate
provider error rate
transaction submit success
verification success
OAuth failures
latency
OpenAI cost per active user
```

## Exit criteria

Internal production-readiness checklist completed.

---

# Phase 14 — Private Alpha

## Target

10–25 Yahoo fantasy users.

## Measure

### Reliability

- successful Yahoo connection rate;
- roster sync success;
- transaction proposal accuracy;
- provider transaction success;
- verification success.

### AI quality

- player resolution accuracy;
- recommendation usefulness;
- correction frequency;
- hallucination incidents;
- accidental mutation attempts.

### Product

- chats per user/week;
- recommendations acted upon;
- confirmation conversion;
- weekly retention;
- time saved.

## Required feedback

Ask:

```text
What did you expect the agent to do?
What did it misunderstand?
What fantasy task still made you open Yahoo manually?
Would you trust it with lineup changes?
Would you pay for this?
```

## Exit criteria

Critical workflows are reliable enough for a broader beta.

---

# Phase 15 — Public MVP / Beta

## Scope

Ship:

```text
Yahoo connection
league selection
roster sync
AI chat
waiver analysis
FAAB recommendations
waiver claims
add/drop
lineup changes
approvals
verification
activity log
manager preferences
notifications
```

No autopilot.

## Product promise

> Manage your fantasy team by talking to your AI GM.

---

# Phase 16 — Post-MVP Roadmap

## V2

### Trades

Tools:

```text
analyze_trade
prepare_trade_offer
prepare_trade_response
```

### Additional providers

Recommended order should be determined by:

- API quality;
- write support;
- user demand;
- provider terms.

### Better analytics

Integrate licensed/current sources for:

- projections;
- injuries;
- snap share;
- targets;
- routes;
- red-zone usage;
- betting lines;
- schedule strength.

Keep provider fantasy state separate from third-party analytics.

---

## V3

### Weekly agent workflows

Examples:

```text
Tuesday waiver review
Wednesday waiver result review
Thursday injury review
Sunday lineup review
```

### Constrained automation

Example:

> If one of my starters is ruled OUT before kickoff, notify me and prepare the best legal replacement.

A future higher-trust mode could allow narrowly scoped automatic actions, but only after explicit opt-in and strong controls.

---

# Engineering Backlog by Priority

## P0 — Must prove

- [ ] Yahoo developer app
- [ ] OAuth
- [ ] league retrieval
- [ ] team retrieval
- [ ] roster retrieval
- [ ] player availability
- [ ] write capability determination
- [ ] disposable transaction verification

## P1 — Core MVP

- [ ] normalized domain model
- [ ] Yahoo provider adapter
- [ ] app authentication
- [ ] Yahoo connection UX
- [ ] selected league
- [ ] roster UI
- [ ] conversational agent
- [ ] read tools
- [ ] player resolver
- [ ] transaction state machine
- [ ] waiver proposal
- [ ] approval UX
- [ ] waiver submission
- [ ] provider verification
- [ ] audit log

## P2 — MVP expansion

- [ ] add/drop
- [ ] lineup changes
- [ ] manager preferences
- [ ] push notifications
- [ ] activity feed
- [ ] production dashboards

## P3 — Later

- [ ] trades
- [ ] additional providers
- [ ] live news ingestion
- [ ] advanced projections
- [ ] multi-league dashboard
- [ ] voice
- [ ] autopilot

---

# Suggested Sprint Breakdown

This is sequencing, not a fixed calendar commitment.

## Sprint 1

- repo bootstrap;
- local infrastructure;
- Yahoo developer app;
- OAuth prototype.

## Sprint 2

- Yahoo league/team/roster reads;
- document provider models;
- Gate 0 write spike.

## Sprint 3

- normalized domain layer;
- Yahoo adapter;
- persistence;
- basic mobile onboarding.

## Sprint 4

- read-only AI agent;
- conversation streaming;
- roster questions;
- evaluation framework.

## Sprint 5

- player resolution;
- transaction engine;
- approval model;
- hard-coded waiver transaction.

## Sprint 6

- `prepare_waiver_claim`;
- approval card;
- execution;
- verification;
- activity log.

## Sprint 7

- add/drop;
- lineup transactions;
- expanded evaluations;
- error UX.

## Sprint 8

- preferences;
- notifications;
- reliability/security hardening;
- private alpha.

---

# MVP Acceptance Test Suite

## Test 1 — Exact waiver command

Input:

> Submit a waiver claim for Cam Skattebo with $30 FAAB, dropping Rachaad White.

Expected:

- correct league;
- correct add player;
- correct drop player;
- $30 bid;
- no execution before confirmation;
- exact proposal rendered.

## Test 2 — Follow-up amount

Conversation:

> I think I want Skattebo. What should I bid?

Agent recommends range.

User:

> Do $27.

Expected:

- conversation resolves Skattebo;
- $27 proposal;
- drop player resolved or requested if required;
- explicit approval.

## Test 3 — Insufficient FAAB

User requests $50 with $32 remaining.

Expected:

- no proposal eligible for execution;
- explain maximum legal amount.

## Test 4 — Ambiguous player

User:

> Drop Williams.

Expected:

- if multiple plausible roster players: request clarification;
- no transaction created.

## Test 5 — No accidental execution

User:

> What would happen if I bid $40?

Expected:

- analysis only;
- no transaction proposal unless user asks to prepare it;
- no execution.

## Test 6 — Rejected approval

User taps Cancel.

Expected:

- state becomes REJECTED;
- transaction can never execute.

## Test 7 — Replay

Client retries execution request.

Expected:

- no duplicate provider transaction;
- existing state returned.

## Test 8 — Changed provider state

Proposal created when player is available, but another manager claims the player before approval.

Expected:

- revalidation fails;
- no invalid transaction submitted;
- user receives updated explanation.

## Test 9 — Verification failure

Provider request returns uncertain response.

Expected:

- status is not reported as successful until verified.

## Test 10 — Unauthorized transaction

User attempts to approve another user's transaction ID.

Expected:

- 404/403;
- audit event;
- no provider call.

---

# Definition of Done for MVP

Fantasy GM MVP is done when:

- [ ] Yahoo connection is secure and reliable.
- [ ] A selected Yahoo football league can be synchronized.
- [ ] The AI accurately answers roster-aware questions.
- [ ] Player references are deterministically resolved.
- [ ] Waiver claims can be prepared from natural language.
- [ ] The user must approve the exact transaction.
- [ ] Approved transactions are safely submitted through a supported provider mechanism.
- [ ] Submission is independently verified.
- [ ] Add/drop and lineup changes use the same architecture.
- [ ] All writes are auditable.
- [ ] Provider credentials are never exposed to the model.
- [ ] Core agent workflows have automated evaluations.
- [ ] The app can support a private alpha without operator intervention for normal flows.

---

# Immediate Next Task

Create the Yahoo feasibility spike project.

The first concrete ticket should be:

```text
FGM-001 — Connect a Yahoo test account and retrieve
the user's fantasy football leagues and team roster.
```

The second:

```text
FGM-002 — Determine and document currently supported
Yahoo fantasy roster-write capability using a disposable league.
```

Do not postpone FGM-002 until after the AI UI is built. It is the principal external dependency of the transactional product.
