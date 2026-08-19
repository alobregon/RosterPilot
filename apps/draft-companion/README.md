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

## Default league preset

The current validation preset is:

- 10 teams
- Half-PPR
- 1 QB
- 2 RB
- 3 WR
- 1 TE
- 1 FLEX (RB/WR/TE)
- 1 DST
- 1 K
- 6 bench spots

That produces a 16-player roster and 160 total selections in a complete 10-team draft. DST and kicker are intentionally deprioritized by the V1 roster-fit model until the final two roster spots.

See `docs/LEAGUE_CONFIG.md` for the complete configuration and recommendation implications.

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
- Bye Week
- Notes

## FantasyPros CSV compatibility

FantasyPros overall rankings exports are supported directly. The importer understands combined `POS` values such as `RB1`, `WR3`, `QB1`, and `TE2`, maps `TIERS` to the internal tier field, and imports `BYE` plus provider metadata used for future recommendation tuning.

The first real FantasyPros fixture contained 100 ranked players and normalized all 100 with zero import warnings. The actual user ranking export is intentionally not committed to this public repository; regression tests use synthetic rows with the same schema.

See `docs/RANKING_IMPORT_FORMATS.md` for the provider mapping and validation details.

## Status

This is the first implementation slice, not the final recommendation model. Next milestones are documented in `docs/DRAFT_COMPANION_IMPLEMENTATION_PLAN.md`.
