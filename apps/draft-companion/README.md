# RosterPilot Draft Companion

Standalone web application for RosterPilot's live fantasy-football draft assistant.

## Current vertical slice

- import rankings from `.xlsx`, `.xls`, or `.csv`
- detect common `Player`, `Position`, `Rank`, `Team`, `Tier`, and `ADP` headers
- manually enter picks in snake-draft order
- automatically assign each pick to the team on the clock
- track the user's roster
- undo the latest pick
- filter/search remaining players
- calculate three explainable recommendation-strength scores

The recommendation engine is intentionally deterministic. User-provided rankings remain the primary value signal; roster fit, tier urgency, and value at the next user pick modify that baseline.

## Run locally

From the repository root:

```bash
npm install
npm run dev:draft
```

Then open the local Next.js URL printed by the dev server.

## Spreadsheet requirements

Required columns (common aliases are accepted):

- Player
- Position
- Rank

Optional columns:

- Team
- Position Rank
- Tier
- ADP
- Projected Points
- Notes

## Status

This is the first implementation slice, not the final recommendation model. Next milestones are documented in `docs/DRAFT_COMPANION_IMPLEMENTATION_PLAN.md`.
