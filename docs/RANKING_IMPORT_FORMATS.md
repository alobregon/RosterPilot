# RosterPilot Ranking Import Formats

This document records ranking-provider formats that have been validated against Draft Companion.

## FantasyPros overall rankings CSV

**Validated:** 2026-08-19  
**Fixtures:** User-provided 2026 overall draft rankings exports  
**Latest validation result:** 861 of 861 rows imported with zero warnings after provider-format and identity normalization.

The raw ranking exports are not committed to this public repository. Tests use synthetic rows that reproduce the provider schema and known edge cases without redistributing ranking content.

### Observed headers

```text
RK
TIERS
PLAYER NAME
TEAM
POS
BYE
UPSIDE
BUST
SOS
ECR VS ADP
AVG. DIFF
% OVER
```

### Field mapping

| FantasyPros field | RosterPilot field | Notes |
| --- | --- | --- |
| `RK` | `overallRank` | Required overall ranking. |
| `PLAYER NAME` | `name` | Required player display name. |
| `TEAM` | `nflTeam` | NFL team abbreviation and part of the current import identity. |
| `POS` | `position` + `positionRank` | Combined values such as `RB1`, `WR3`, `QB1`, and `TE2` are split during import. |
| `TIERS` | `tier` | Provider tier value. |
| `BYE` | `byeWeek` | Bye week. |
| `UPSIDE` | `sourceMetadata.upsideRating` | Parsed from values such as `5 out of 5`. |
| `BUST` | `sourceMetadata.bustRating` | Parsed from values such as `1 out of 5`. |
| `SOS` | `sourceMetadata.strengthOfScheduleRating` | Parsed from values such as `4 out of 5 stars`. |
| `ECR VS ADP` | `sourceMetadata.ecrVsAdp` | Preserved as a comparison metric; it is **not** treated as raw ADP. |
| `AVG. DIFF` | `sourceMetadata.averageDifference` | Signed numeric value. |
| `% OVER` | percent-over metadata | Parses the percentage and expert-count expression, for example `50% (8/16)`. |

### Position normalization

FantasyPros combines position and positional rank in one value:

```text
RB1  -> position=RB, positionRank=1
WR12 -> position=WR, positionRank=12
QB3  -> position=QB, positionRank=3
TE5  -> position=TE, positionRank=5
```

The generic importer also accepts plain position values such as `RB`, `WR`, `QB`, and `TE`. Defense aliases such as `DST`, `DEF`, and `D/ST` are normalized to `DST`, including optional positional-rank suffixes.

### Deep-export player identity

FantasyPros abbreviates first names. In the 861-player export, nine name/position pairs refer to different players, including cases such as two `J. Taylor` RBs on different NFL teams.

Using only `name + position` would incorrectly collapse those rows. The current import identity is therefore:

```text
normalized name + normalized position + NFL team
```

Example:

```text
J. Taylor / RB / IND -> j-taylor-rb-ind
J. Taylor / RB / JAC -> j-taylor-rb-jac
```

Exact duplicates with the same name, position, and team are still rejected with a warning.

This is an import-snapshot identity, not the final long-term player-identity strategy. When provider or canonical player IDs become available, they should replace team-dependent identity so trades do not change a player's durable ID.

### Extended-pool coverage

The latest export contains 861 ranked players, including enough QB, RB, WR, TE, DST, and K depth to cover the full 160 selections in the current 10-team, 16-roster-spot league.

The extended file replaces the earlier top-100 export for full-draft validation. Ranking sets should not be appended together because the later export may contain updated rankings within the overlapping top 100.

### Recommendation-engine use

For the current V1 recommendation engine, the authoritative inputs from this export are:

- overall rank
- position
- positional rank
- tier
- team

Bye week and the additional FantasyPros metrics are preserved for later scoring and explanation work but are not yet given recommendation weight.

In particular, `ECR VS ADP` must not be substituted for a raw ADP value. Future availability modeling should either use a true ADP source or explicitly model the comparison metric as a separate feature.

### File-depth-independent ranking value

Recommendation ranking value is derived from absolute overall rank using a fixed decay curve rather than normalizing against the largest rank in the uploaded file.

This guarantees that a Rank 20 player has the same ranking-value component whether the user imports a top-100 list or an 861-player list. The current curve uses a 100-pick half-life:

```text
rankingValue = 100 * 0.5 ^ ((overallRank - 1) / 100)
```

The exact curve can be tuned later, but file-depth invariance is a required property.

## Adding another provider

A new provider format should be accepted only after:

1. its headers are mapped to the normalized player model;
2. provider-specific position formatting is normalized;
3. representative synthetic regression rows are added;
4. malformed data produces warnings rather than silent corruption;
5. identity collisions are handled deterministically; and
6. the real fixture imports without manual cleanup.
