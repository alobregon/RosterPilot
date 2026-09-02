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

The default recommendation strategy prefers to fill DST and kicker in the final two roster spots so higher-upside RB/WR/TE bench options are not displaced unnecessarily.

DST suppression is **run-aware rather than absolute**. The engine monitors the most recent eight selections:

- one early DST selection does not change the recommendation;
- two DST selections in the recent window create a modest urgency increase;
- three DST selections create a stronger urgency increase;
- four or more DST selections create a substantial urgency increase.

This does not automatically make DST the recommended pick. Overall player ranking, tier scarcity, roster fit, and value at the upcoming user selection still compete with the run signal. The intent is to recognize that the cost of waiting on defense changes when the room begins taking defenses earlier than expected.

Tier urgency remains independent, so an active DST run combined with only one or two defenses remaining in a preferred tier can move a DST meaningfully higher than either signal would on its own.

Kicker remains a deliberate late-round preference for now; it does not yet react to kicker runs.

These are recommendation heuristics, not league legality rules. Users may manually draft DST or K at any time.

### Half-PPR scoring

`HALF_PPR` is represented directly in `DraftConfig`.

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
