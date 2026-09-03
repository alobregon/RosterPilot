# Draft Companion Recommendation Engine V2

## Goal

Recommendation Engine V2 keeps the engine deterministic and explainable while adding live-draft context. The UI exposes one independent **Recommendation strength** for each of the Top 3. It is a 0-100 composite score, not a probability that a player will succeed and not a share that must sum to 100%.

## Inputs

V2 considers:

- user-provided overall rankings
- roster construction and starter needs
- tier scarcity
- value at the user's upcoming selection
- bye-week concentration
- recent positional runs
- opponent roster needs before the user's following turn
- heuristic future availability
- selected draft strategy
- user-selected favorite players (My Guys)
- curated offseason context as a bounded final tie-breaker

## Base score

The current base score uses:

| Signal | Weight |
| --- | ---: |
| Ranking value | 42% |
| Roster fit | 20% |
| Tier urgency | 15% |
| Value at selection | 15% |
| Future availability urgency | 5% |
| Bye-week fit | 3% |

Draft strategy is applied as a bounded adjustment of up to +/- 6 raw-score points after the base score. Balanced strategy applies no adjustment.

Favorites are a separate bounded adjustment of up to +5 raw-score points. The boost is price-sensitive: it is strongest when a favorite has fallen at least 10 picks past the user's ranking, meaningful around fair value, and nearly neutral for a major reach. Favorites never override mandatory roster-position constraints.

Curated offseason context is applied later in the on-clock wrapper as a final **+/-3 raw-score-point maximum** tie-breaker. It does not alter the imported player ranking, tier, ADP, survival probability, or any base-score component.

## Recommendation strength

After candidates are scored, each Top-3 raw score is independently rounded and clamped to the 0-100 range. This supports the draft-advice presentation `Player — Position — 91%` and preserves the distance between the engine's absolute evaluations. A set such as `91% / 86% / 82%` is valid and intentionally does not sum to 100%.

Example:

```text
C. Lamb        91%
J. Taylor      87%
C. McCaffrey   84%
```

The ordering still comes directly from raw score. Return probability remains a separate calibrated quantity.

## Future Availability V1

Future availability asks whether a candidate is likely to survive from the user's upcoming selection to the user's following selection.

For a 10-team snake draft with the user in slot 7:

```text
Selection: 1.07 (#7)
Return:    2.04 (#14)
Picks between: #8, #9, #10, #11, #12, #13
Slots between: 8, 9, 10, 10, 9, 8
```

The urgency heuristic combines:

- candidate overall rank relative to the return pick
- positional demand from the unique opponent rosters between turns
- additional opportunities for teams drafting twice at the turn
- recent positional-run pressure
- scarcity in the best currently available tier

V1 labels the internal result as Likely, Uncertain, or Unlikely. The UI does not display a second percentage for this signal; it appears only as explanation text such as `Unlikely to make it back to pick #14`.

The final user selection has no return pick. Future availability is neutral on that selection and does not invent a pick beyond the end of the draft.

## Opponent demand

Opponent demand is inferred from every entered pick. RB and WR missing starters receive the strongest early demand. In a 1QB / 1TE format, merely not having drafted a QB or TE yet does not carry the same urgency as an unfilled RB or WR starter.

FLEX demand is activated only after a team's base RB/WR/TE starter requirements are satisfied. This prevents an open RB2 slot from being misread as generic FLEX demand.

## Positional runs

The recent window is eight selections. Approximate run thresholds are:

- RB / WR: 4 selections
- QB / TE: 3 selections
- DST: 2 selections
- K: 3 selections

A run raises future-availability pressure; it does not automatically force the user to chase the position.

## Tier urgency

Tier scarcity applies only to the best currently available tier at the player's position. A singleton player in a worse tier does not get scarcity credit while a better tier remains available.

## Roster construction

Balanced V2 gives diminishing bench-depth credit as a position becomes saturated. Because the default league starts three WRs, WR depth retains value longer than RB depth.

FLEX fit is considered only after base RB, WR, and TE starters are filled.

When remaining roster slots equal the minimum number of unfilled legal lineup requirements, recommendations are constrained to positions that can satisfy those requirements. This guarantees that a user who has delayed DST/K can still finish with a legal roster.

## Favorites / My Guys

Any player can be starred as a favorite in the player pool. Favorites are user-controlled, persisted with the local draft snapshot, and can be viewed with a dedicated Favorites filter.

Favorite preference is deliberately asymmetric: it can break a close decision or encourage the user to capitalize when a favorite falls, but it does not force a reach. Current favorite-fit levels are based on the user's upcoming selection relative to the player's imported overall rank:

- 10+ picks of value: maximum favorite boost
- 5-9 picks of value: strong boost
- at/after ranking: meaningful boost
- within 5 picks ahead of ranking: modest boost
- 6-10 picks ahead of ranking: small boost
- more than 10 picks ahead: nearly neutral

When a favorite materially contributes to a Top-3 recommendation, explanation text calls it out explicitly, for example `Favorite who has fallen 8 picks past your ranking`.

The current FantasyPros export does not contain raw ADP, so V2 measures favorite value against the user's imported overall rank. A future market/ADP integration can add a second price reference without changing the user-facing Favorite feature.

## Draft strategies

Supported first-pass presets:

- Balanced
- Hero RB
- Zero RB
- Robust RB
- WR Heavy
- Late QB
- Elite TE
- Upside Heavy

Strategy is a bounded preference, not an override of legality or a replacement for rankings. Examples from the validation simulation:

- Late QB delays quarterback until approximately Round 7.
- Zero RB avoids RB through the first five rounds, then increases RB urgency.
- Hero RB prioritizes one early anchor RB and then shifts toward WR/TE.
- Robust RB targets three early RBs before pivoting.
- WR Heavy can open WR/WR/WR in this 3-WR league.
- Upside Heavy uses the imported FantasyPros upside rating when present.

## Offseason context tie-breaker

The on-clock wrapper reads curated entries from `offseason-context.ts` through `context-signal.ts`. Only the entry outlook is converted to score; source-grounded facts remain available for explanation and the future AI coach.

The signal combines:

- direction: positive / mixed-positive / mixed / mixed-negative / negative;
- confidence: low-medium through high;
- origin: source consensus, source analyst, source conflict, or explicit RosterPilot inference.

The combined signal is capped at +/-3 score points, then rank/tier discipline is applied. Context therefore behaves like a close-call nudge rather than a parallel ranking system.

Current rank-gap guardrails:

```text
Rounds 1-2: full within 1 rank; no context boost beyond 4 ranks
Rounds 3-4: full within 2 ranks; no context boost beyond 6 ranks
Rounds 5-8: full within 3 ranks; no context boost beyond 9 ranks
Rounds 9+:  full within 4 ranks; no context boost beyond 12 ranks
```

A one-tier disadvantage halves the remaining context effect; a two-tier-or-greater disadvantage suppresses it completely. K and DST receive no offseason context adjustment.

This directly captures the walkthrough behavior we want:

- Amon-Ra can receive a small positive nudge against a nearly identical early-round alternative while CMC's current risk context can nudge the other direction;
- Ladd McConkey can move ahead in a close Round-4 WR decision when the ranking gap is small;
- Jayden Reed and Makai Lemon can receive mid/late-round opportunity boosts;
- positive Ashton Jeanty context cannot override a meaningful early rank/tier gap to the final Tier-2 value.

When the adjustment materially affects a displayed candidate, the recommendation reasons include a source-labeled `context boost` or `context caution` explanation.

## Validation

The extended FantasyPros pool contains 861 players. A deterministic 160-pick smoke simulation was run for every draft slot from 1 through 10 using the default league configuration.

Across all slots:

- every user roster completed 16 selections
- every roster filled QB, RB, WR, TE, DST, and K requirements
- recommendation strengths remained within 0-100 and followed raw-score order
- no final-pick recommendation referenced a nonexistent later selection
- balanced roster construction avoided the earlier extreme RB-heavy result

For slot 7, the balanced simulation produced:

```text
QB  1
RB  5
WR  7
TE  1
DST 1
K   1
```

The opponent simulation is intentionally simple (non-user teams choose the highest remaining overall rank). It is a regression/sanity harness, not a prediction of real league behavior.

Walkthrough-derived context regression coverage additionally verifies close-call positive/negative signals, Ladd's bounded Round-4 contextual move, Reed/Lemon mid-round boosts, and suppression of an early rank/tier jump.

## Recommendation explanation UI

The UI exposes exactly one recommendation-strength percentage per candidate. Supporting decision context is shown as non-numeric labels or explanation text rather than additional confidence values.

Each card now includes:

- a decisive verdict (`This is my pick.` for the top candidate);
- draft-value language grounded in the current pick and imported ranking;
- current player context drawn only from the curated evidence journal;
- a sentence describing the user's roster after making the pick;
- source links for the facts used;
- expandable deterministic engine signals.

The rules engine always generates a complete fallback narrative. If configured, the server-side OpenAI Responses API may polish only the wording through Structured Outputs. Candidate order, recommendation strength, roster state, and evidence remain application-owned. Model-returned evidence IDs are allowlisted against the evidence sent for that player before the enhanced copy reaches the UI.

Current signals include:

- Likely / Uncertain / Unlikely to return by the user's following pick;
- Starter need;
- Tier cliff;
- Favorite / My Guy;
- selected strategy fit when the strategy materially boosts the candidate;
- source-labeled offseason `context boost` / `context caution` explanations when the bounded signal is active.

The offseason explanation represents a bounded scoring input, but the imported ranking remains the authoritative player-value anchor.

## Opponent demand hardening

Opponent positional demand now diminishes as a roster becomes saturated. Missing RB/WR starters remain high urgency, but teams carrying multiple bench players at the position no longer contribute the same demand signal indefinitely. QB and TE demand similarly drops sharply after starter needs are satisfied.

This improves turn modeling because a team with five RBs should not exert the same pressure on an available RB as a team still missing RB2.

## Future Availability V2 market signal

When ADP is present in the imported rankings, Future Availability uses it as a bounded market-timing signal. It affects only the estimate of whether a player is likely to survive until the user's following selection; it does not replace the user's overall ranking as the player-value anchor.

The availability pressure split is currently:

- user overall-rank pressure: 35%
- market ADP pressure: 15%
- opponent positional demand: 30%
- recent positional run: 12%
- tier scarcity: 8%

If ADP is absent, the ADP component falls back to the user-rank pressure, preserving the previous rank-only behavior.

## Full-draft simulation harness

A reusable deterministic simulation harness now runs the recommendation engine through complete drafts. Opponent teams choose the highest-ranked remaining player; the user's slot takes the engine's top recommendation.

The harness validates:

- full draft completion;
- user roster length;
- legal fixed starter and FLEX coverage;
- required DST/K completion;
- Recommendation strength bounds and raw-score ordering at every user pick.

The real 861-player pool was re-run through all ten draft slots with Josh Allen and Ladd McConkey marked as Favorites. Slots 1 and 2 used the current Hero RB opening default. All ten user rosters completed legally.
