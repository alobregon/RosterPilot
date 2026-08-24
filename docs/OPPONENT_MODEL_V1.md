# Purple League Opponent Model V1

## Purpose

Opponent Model V1 adds league-specific manager tendencies to the Draft Companion's **Future Availability** signal.

The model answers a narrow question:

> Given the managers drafting before my next turn, does this player's position look more or less likely than normal to be selected?

It does **not** change the player's imported overall ranking, invent player-level reach tendencies, or override roster legality and draft strategy.

## Data source

V1 consumes `research/league_manager_profiles_2013_2025.json`, generated from corrected Purple League draft history.

The profile data includes:

- recency-weighted position probabilities by draft phase;
- first-QB and first-TE timing tendencies;
- historical roster construction;
- same-position repeat behavior;
- positional-run response behavior.

Historical ADP/ECR is not yet joined to the manager history, so V1 deliberately avoids claims such as "this manager reaches 12 picks for players they like."

## Manager matching

During league setup, each slot already accepts an optional opponent label. V1 attempts to match that label against:

1. manager ID;
2. manager display name;
3. known 2025 team name.

Matching ignores punctuation, spaces, capitalization, and accents.

Examples that resolve to the same manager:

```text
Armando
The Kittle Engine that Could
```

Generic labels such as `Team 8` do not activate historical modeling.

## Draft phases

Historical position tendencies are grouped into four phases:

- Rounds 1–4
- Rounds 5–8
- Rounds 9–12
- Rounds 13–16

For each opponent who drafts before the user's return pick, the model compares that manager's recency-weighted probability of drafting the candidate's position against the **Purple League average for the same phase**.

This makes the signal relative rather than treating every manager's raw position probability as equally meaningful.

## Availability adjustment

For each matched opponent:

1. determine every pick that manager owns before the user's return pick;
2. calculate the manager's phase-relative positional tendency at those picks;
3. average the tendency across that manager's opportunities;
4. apply a modest extra weight when the same manager picks twice around a snake-draft turn;
5. combine all matched managers;
6. clamp the total Future Availability adjustment to ±14 points.

An individual manager contribution is capped at ±8 Future Availability points.

The resulting Future Availability change is still subject to the existing 5% Future Availability weight in the recommendation engine. Therefore even the maximum historical adjustment changes the raw recommendation score by less than one point.

## Explainability

When a matched manager creates meaningful positive pressure, the recommendation explanation can surface text such as:

```text
Armando historically leans TE in this draft phase
```

Negative historical pressure is used internally to modestly increase the chance that a player survives, but V1 does not clutter the Top 3 explanation list with every low-probability manager signal.

## Safety rails

Opponent Model V1 is intentionally bounded:

- no opponent label match → zero adjustment;
- no return pick → zero adjustment;
- imported overall ranking is never modified;
- ADP/market-fall logic is unchanged;
- recommendation strategy is unchanged;
- roster legality is unchanged;
- maximum Future Availability adjustment is ±14;
- maximum raw recommendation-score effect is <1 point.

## Current limitation

The current UI field is labeled as an optional team name/opponent label. To activate historical manager modeling reliably, enter either the manager name or a recognized historical team name for each slot.

A future setup improvement should expose explicit manager selection/autocomplete so current team names can change without breaking identity matching.

## Next evolution

V2 should consider:

- explicit manager selection in league setup;
- roster-state-conditioned historical tendencies;
- QB/TE timing priors beyond generic phase probabilities;
- response-to-run tendencies when sample size is sufficient;
- historical ADP/ECR joins for true manager-specific reach/value behavior;
- calibrated opponent pick probabilities suitable for Monte Carlo draft simulation.
