# Draft Companion League Configuration

This document records the league configuration currently used as the default validation preset for RosterPilot Draft Companion.

## Default league preset

- **Teams:** 10
- **Scoring:** Half-PPR
- **Draft:** Snake
- **Roster size:** 16 players per team

### Starting lineup

| Slot | Count | Eligibility |
| --- | ---: | --- |
| QB | 1 | QB |
| RB | 2 | RB |
| WR | 3 | WR |
| TE | 1 | TE |
| FLEX | 1 | RB / WR / TE |
| DST | 1 | DST |
| K | 1 | K |

### Bench

- **Bench spots:** 6

The league therefore drafts **160 total players** when all 10 teams fill all 16 roster spots.

## Recommendation-engine implications

### Three-WR structure

Because the league starts three wide receivers plus an RB/WR/TE FLEX, WR depth should carry more roster-construction value than it would in a typical two-WR league. The current roster-fit engine recognizes three required WR starters and the shared FLEX pool.

### FLEX eligibility

The FLEX slot is explicitly limited to:

- RB
- WR
- TE

QB, DST, and K are not FLEX eligible.

### DST and kicker timing

The default recommendation strategy intentionally suppresses DST and kicker roster-fit value until the final two roster spots. With a 16-player roster, this means the engine should generally prefer skill-position bench upside through the first 14 selections unless a future strategy override says otherwise.

This is a recommendation heuristic, not a league legality rule. Users may still manually draft DST or K at any time.

### Half-PPR scoring

`HALF_PPR` is now represented directly in `DraftConfig`.

For Recommendation Engine V1, the uploaded ranking sheet remains the authoritative player-value source. The scoring-format field is therefore primarily configuration metadata today; future recommendation versions may use it for position-value adjustments, projections, replacement-level calculations, and simulation.

## Current `DraftConfig`

```ts
{
  teamCount: 10,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
  dstStarters: 1,
  kStarters: 1,
  benchSpots: 6,
}
```

`userDraftSlot` remains configurable because draft position may change from draft to draft.

## Future configuration UI

The current standalone app uses this league as its default preset while retaining editable team count and user draft slot controls.

A later league-setup screen should allow users to create or save other formats, including:

- Standard, Half-PPR, and PPR scoring
- different team counts
- 2-WR or 3-WR formats
- multiple FLEX slots
- SUPERFLEX / 2QB
- no-kicker or no-DST leagues
- different bench sizes

The recommendation engine should consume normalized league configuration rather than hard-code one league format outside the default preset.
