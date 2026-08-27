# RosterPilot player-profile data

RosterPilot's AI-coach design separates **draft intelligence**, **historical player facts**, and **future projections/current news**. The deterministic recommendation engine remains authoritative; player profiles provide grounded context that an AI analyst can explain without inventing player facts.

## V1: nflverse historical actuals

The first player-profile layer uses the free nflverse regular-season player-stat releases:

```text
https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_<YEAR>.csv
```

The server endpoint is:

```text
GET /api/nflverse/player-profile?name=Amon-Ra%20St.%20Brown&position=WR&seasons=2025,2024,2023
```

If `seasons` is omitted, RosterPilot requests the three completed calendar years preceding the current year. A request may include up to five seasons.

### Normalized profile fields

V1 intentionally includes only fields documented by nflverse's player-stats data dictionary:

- stable nflverse/GSIS `player_id`
- full player display name
- position and team
- games
- passing attempts, completions, yards, touchdowns, and interceptions
- carries, rushing yards, and rushing touchdowns
- targets, receptions, receiving yards, and receiving touchdowns
- nflverse standard and PPR fantasy points
- derived half-PPR fantasy points
- selected per-game rates derived from the season totals

Half-PPR historical points are derived as:

```text
half-PPR points = nflverse fantasy_points + (0.5 * receptions)
```

This follows nflverse's published scoring relationship where `fantasy_points_ppr` equals `fantasy_points + receptions`.

### Matching and safety

Player names are normalized for case, punctuation, accents, apostrophes, and whitespace, but V1 still requires an exact normalized full-name match. A caller may supply `position` to disambiguate. If the same normalized name maps to multiple player IDs, the endpoint returns an ambiguity response instead of guessing.

The endpoint labels the returned data as `historical_actuals`. It must not be described to users or to an LLM as a future projection. RosterPilot also does not infer advanced metrics that are not present in this V1 dataset.

Specifically, V1 does **not** claim or synthesize:

- snap share
- target share
- routes run
- yards per route run
- red-zone opportunity share
- current injury/news context
- 2026 projected stat lines

Those can be added later from separately verified sources.

## Why nflverse

nflverse publishes its automated datasets through the `nflverse-data` GitHub repository and documents `load_player_stats()` as player statistics intended to match NFL official box scores and season summaries. The repository package is licensed CC BY 4.0. RosterPilot should retain nflverse attribution, and any future commercial release should separately review rights associated with each underlying dataset/source.

Useful references:

- `https://nflreadr.nflverse.com/reference/load_player_stats`
- `https://nflreadr.nflverse.com/articles/dictionary_player_stats.html`
- `https://github.com/nflverse/nflverse-data`

## FantasyPros projection status

RosterPilot also has a server-only FantasyPros diagnostic client. Testing with the current free public key showed:

- the broad 2026 WR projection response declared 190 players but returned 10;
- those returned player identities contained an empty projection `stats` array;
- a targeted request for a single FantasyPros player ID returned that player but still contained no projection stats.

Therefore the free FantasyPros tier is useful for integration development/player identity testing, but RosterPilot does not currently treat it as a source of usable future statistical projections. Premium/full FantasyPros projections can be evaluated later if the historical-profile prototype proves valuable.

## Intended AI-coach composition

A future AI-coach request can combine a small, relevant set of profiles with RosterPilot's live deterministic state:

```text
RosterPilot draft state
  + current rankings / ADP / tiers
  + recommendation score components
  + chance-back probabilities
  + opponent / positional-run signals
  + nflverse historical player profile
  + future projection/news layer (later)
        -> AI analyst
```

Only the top relevant candidates should be sent to the AI, not the entire player database. The AI should distinguish supplied historical actuals from projections and current news, and should make no player-specific factual claim that is unsupported by the supplied data.
