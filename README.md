# RosterPilot

**Your AI Fantasy GM.**

RosterPilot is an AI-powered fantasy sports management application designed to let users analyze and manage fantasy teams through natural-language conversation.

The long-term target interaction:

> “Submit a waiver claim for Cam Skattebo with $30 FAAB, dropping Rachaad White.”

RosterPilot should understand the request, resolve the league/team/players, validate the transaction, show the exact action for approval, submit it through the fantasy provider, verify the result, and keep an audit trail.

## Active development: Draft Companion

The first feature being developed is a standalone web-based **Draft Companion** in `apps/draft-companion`.

It is designed to:

- import the user's fantasy-football ranking spreadsheet;
- track a live snake draft through fast manual pick entry;
- maintain available players and team rosters;
- evaluate roster fit, tier urgency, and ranking value;
- present three explainable recommendations for the user's next pick.

Run it from the repository root:

```bash
npm install
npm run dev:draft
```

See `docs/DRAFT_COMPANION_IMPLEMENTATION_PLAN.md` for the feature roadmap and engineering plan.

## Broader RosterPilot architecture

The original provider-integrated fantasy-management architecture remains the long-term direction. Yahoo/provider integration is intentionally decoupled from Draft Companion development so the recommendation experience can be validated first.

See `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` for the broader RosterPilot design and staged roadmap.
