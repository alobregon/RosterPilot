# RosterPilot

**Your AI Fantasy GM.**

RosterPilot is an AI-powered fantasy sports management application designed to let users analyze and manage fantasy teams through natural-language conversation.

The target interaction:

> “Submit a waiver claim for Cam Skattebo with $30 FAAB, dropping Rachaad White.”

RosterPilot should understand the request, resolve the league/team/players, validate the transaction, show the exact action for approval, submit it through the fantasy provider, verify the result, and keep an audit trail.

## First milestone

The first engineering gate is proving Yahoo Fantasy integration safely:

1. **FGM-001** — Connect a Yahoo test account and retrieve leagues/team/roster.
2. **FGM-002** — Determine and document currently supported Yahoo roster-write capability in a disposable league.

See `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` for the design and staged roadmap.
