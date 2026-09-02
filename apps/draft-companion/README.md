# RosterPilot Draft Companion

Standalone web application for RosterPilot's live fantasy-football draft assistant.

## Current vertical slice

- import rankings from `.xlsx`, `.xls`, or `.csv`
- support deep FantasyPros overall-ranking exports
- manually enter picks in snake-draft order
- render a full 10-team × 16-round live draft board
- automatically assign each pick to the team on the clock
- track every team's picks plus the user's roster
- undo or restart the draft
- filter/search remaining players
- automatically persist normalized rankings, picks, league configuration, and strategy in browser storage
- calculate three explainable recommendations with a single relative **Recommendation %** that sums to 100%
- model roster fit, tiers, bye weeks, recent positional runs, opponent demand, and heuristic future availability
- support Balanced, Hero RB, Zero RB, Robust RB, WR Heavy, Late QB, Elite TE, and Upside Heavy strategy presets

The recommendation engine is intentionally deterministic. User-provided rankings remain the primary value signal while live draft context changes the relative urgency of otherwise comparable choices.

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

That produces a 16-player roster and 160 total selections in a complete 10-team draft. DST and kicker are generally delayed, but the recommendation engine can react to an actual DST run and guarantees required lineup positions are filled before the roster is complete.

For the current user validation preset, choosing draft slot 1 or 2 starts with **Hero RB** selected; slots 3-10 start Balanced. Strategy remains editable during the draft.

See `docs/LEAGUE_CONFIG.md` and `docs/RECOMMENDATION_ENGINE_V2.md` for the full configuration and scoring model.

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

FantasyPros overall rankings exports are supported directly. The importer understands combined `POS` values such as `RB1`, `WR3`, `QB1`, and `TE2`, maps `TIERS` to the internal tier field, and imports `BYE` plus provider metadata used for recommendation tuning.

The latest real FantasyPros fixture contains 861 ranked players and normalizes all 861 with zero import warnings after identity normalization. The raw user ranking export is intentionally not committed to this public repository; regression tests use synthetic rows with the same schema.

See `docs/RANKING_IMPORT_FORMATS.md` for the provider mapping and validation details.

## Recommendation Engine V2

The Top 3 expose one percentage each. These values are relative preference shares, not outcome probabilities, and always sum to 100%.

Future Availability V1 estimates whether a candidate is likely to survive until the user's following selection by combining ranking pressure, opponent roster needs between turns, snake-turn opportunities, positional runs, and tier scarcity. Strategy is applied as a bounded preference rather than an override of rankings or roster legality.

See `docs/RECOMMENDATION_ENGINE_V2.md` for weights, heuristics, validation, and strategy behavior.
