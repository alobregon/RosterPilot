# RosterPilot Ranking Import Formats

This document records ranking-provider formats that have been validated against Draft Companion.

## FantasyPros overall rankings CSV

**Validated:** 2026-08-19  
**Fixture:** User-provided 2026 overall draft rankings export  
**Validation result:** 100 of 100 rows imported with zero warnings after provider-format normalization.

The raw ranking export is not committed to this public repository. Tests use synthetic rows that reproduce the provider schema without redistributing the ranking content.

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
| `TEAM` | `nflTeam` | NFL team abbreviation. |
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

### Recommendation-engine use

For the current V1 recommendation engine, the authoritative inputs from this export are:

- overall rank
- position
- positional rank
- tier
- team

Bye week and the additional FantasyPros metrics are preserved for later scoring and explanation work but are not yet given recommendation weight.

In particular, `ECR VS ADP` must not be substituted for a raw ADP value. Future availability modeling should either use a true ADP source or explicitly model the comparison metric as a separate feature.

## Adding another provider

A new provider format should be accepted only after:

1. its headers are mapped to the normalized player model;
2. provider-specific position formatting is normalized;
3. representative synthetic regression rows are added;
4. malformed data produces warnings rather than silent corruption; and
5. the real fixture imports without manual cleanup.
