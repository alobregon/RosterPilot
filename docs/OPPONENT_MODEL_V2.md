# Purple League Opponent Model V2

## Purpose

Opponent Model V2 adds player-level historical ADP behavior to the existing Purple League opponent model.

V1 answers:

> Does this manager tend to draft this position in this part of the draft?

V2 adds:

> Relative to market ADP, does this manager tend to take this kind of player earlier or later than the rest of the league?

The combined model is still used only for **Future Availability**. It does not change imported player rankings, tiers, current-year ADP, roster legality, or strategy scoring.

## Historical sources

V2 joins:

- corrected Purple League draft history with player names;
- FantasyPros Overall ADP exports for 2018 through 2025;
- the `AVG` ADP field as the historical market reference.

Raw FantasyPros exports are not committed to the repository. The repository stores only the compact derived manager profile in:

`research/league_manager_adp_profiles_2018_2025.json`

## Join quality

Historical reach modeling is limited to QB/RB/WR/TE. DEF/DST and K are intentionally excluded from the reach model because team-defense naming is inconsistent across sources and late-round kicker reach behavior is not useful for player-level future availability.

Skill-position join coverage:

| Season | Match rate |
| --- | ---: |
| 2018 | 97.14% |
| 2019 | 97.84% |
| 2020 | 99.29% |
| 2021 | 98.56% |
| 2022 | 98.58% |
| 2023 | 98.55% |
| 2024 | 100.00% |
| 2025 | 99.29% |
| **Overall** | **98.65% (1,100 / 1,115)** |

Unmatched skill-position picks are excluded rather than force-matched.

## ADP delta

For every matched historical pick:

```text
adp_delta = actual_overall_pick - FantasyPros_AVG_ADP
```

Interpretation:

- negative = selected ahead of market ADP (a reach);
- zero = selected at market;
- positive = selected after market ADP (a value/fall).

Raw ADP delta is not used directly because a whole league can systematically draft a position earlier or later than the broader market.

## League-relative behavior

For each historical pick, V2 calculates a baseline for the same:

- season;
- draft phase;
- position.

Then:

```text
league_relative_delta = manager_adp_delta - league_mean_adp_delta
```

A negative league-relative value means the manager reaches earlier than the Purple League normally does for the same position and phase. A positive value means the manager tends to wait longer.

This helps separate a manager tendency from a league-wide tendency.

## Recency and shrinkage

Historical picks use the same 0.85 annual recency decay used elsewhere in the manager research.

Manager reach profiles are calculated at three levels:

1. overall manager behavior;
2. position-specific behavior;
3. draft-phase behavior.

Each historical mean is shrunk toward neutral using an eight-pick equivalent prior before it is exported. This prevents small samples from creating large live-draft effects.

The live effective-ADP shift blends:

```text
45% manager overall
35% manager + position
20% manager + draft phase
```

The resulting effective-ADP shift is capped at ±6 picks.

Historical ADP does **not** replace the player's current-year ADP. The shift is only used to compare personalized selection pressure with normal market selection pressure.

## Live reach pressure

For every known opponent pick before the user's return pick:

1. start with the candidate's current ADP;
2. calculate normal market selection pressure at that opponent pick;
3. calculate a manager-personalized effective ADP using the historical reach shift;
4. calculate personalized selection pressure;
5. use only the difference between personalized and normal pressure as the V2 adjustment.

This means V2 adds manager-specific information without counting current ADP twice.

A manager-level reach contribution is capped at ±4.5 Future Availability points. The combined reach contribution across opponents is capped at ±8.

## Combined V1 + V2 safety rail

V1 positional tendency and V2 ADP reach behavior are combined, then the total historical Future Availability adjustment is clamped to the existing:

```text
-14 ... +14
```

The recommendation engine gives Future Availability a 5% weight, so even the maximum historical adjustment changes the raw recommendation score by less than one point.

The historical model therefore remains a tie-breaker / survival-risk signal rather than a player-value engine.

## Explainability

V1 can produce reasons such as:

```text
Armando historically leans TE in this draft phase
```

V2 can additionally produce:

```text
Juan historically reaches for TE ahead of league ADP
```

Reasons are surfaced only for meaningful positive pressure so the Top 3 recommendation cards are not flooded with weak historical observations.

## Missing ADP behavior

If a current player has no ADP, V2 contributes zero reach adjustment and V1 continues to work normally.

If a manager is not explicitly assigned and cannot be matched by the legacy label fallback, both V1 and V2 contribute zero for that opponent.

## Future calibration

Potential later improvements:

- position + phase interaction profiles once sample sizes justify them;
- player archetypes such as rookies, veterans, or handcuffs;
- explicit uncertainty intervals around manager shifts;
- out-of-sample backtesting by season;
- calibrated pick probabilities suitable for Monte Carlo draft simulation.
