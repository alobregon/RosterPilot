# Purple League Opponent Model V2

## Status

**Research-complete, live scoring disabled.**

Opponent Model V2 adds player-level historical ADP behavior to the Purple League research model, but its first chronological out-of-sample backtest did not beat a neutral-manager baseline on MAE. The derived profiles and scorer remain in the repository for future calibration; the live Draft Companion currently forces the V2 reach adjustment to zero.

See `docs/OPPONENT_MODEL_V2_BACKTEST.md` for the release decision and detailed results.

## Purpose

V1 answers:

> Does this manager tend to draft this position in this part of the draft?

V2 investigates:

> Relative to market ADP, does this manager tend to take this kind of player earlier or later than the rest of the league?

Even if re-enabled later, V2 is designed only to refine **Future Availability**. It must never rewrite imported player rankings, tiers, current-year ADP, roster legality, or strategy scoring.

## Historical sources

V2 joins:

- corrected Purple League draft history with player names;
- FantasyPros Overall ADP exports for 2018 through 2025;
- the `AVG` ADP field as the historical market reference.

Raw FantasyPros exports are not committed to the repository. The repository stores only the compact derived manager profile in:

`research/league_manager_adp_profiles_2018_2025.json`

## Join quality

Historical reach research is limited to QB/RB/WR/TE. DEF/DST and K are excluded because team-defense naming is inconsistent across sources and late-round kicker reach behavior is not useful for player-level future availability.

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

- negative = selected ahead of market ADP;
- zero = selected at market;
- positive = selected after market ADP.

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

A negative league-relative value means the manager reached earlier than the Purple League normally did for the same position and phase. A positive value means the manager waited longer.

## Recency and shrinkage

Historical picks use 0.85 annual recency decay.

Manager reach profiles are calculated at three levels:

1. overall manager behavior;
2. position-specific behavior;
3. draft-phase behavior.

Each historical mean is shrunk toward neutral using an eight-pick equivalent prior before export.

The research scorer blends:

```text
45% manager overall
35% manager + position
20% manager + draft phase
```

The resulting effective-ADP shift is capped at ±6 picks.

`historicalAdpShift()` exposes this research score, but the score is not currently applied to live recommendations.

## Originally proposed live reach pressure

The V2 prototype compared normal market selection pressure with a manager-personalized effective ADP at each opponent pick before the user's return pick.

Prototype safety rails were:

- manager-level reach contribution capped at ±4.5 Future Availability points;
- combined reach contribution capped at ±8;
- V1 + V2 historical adjustment capped at ±14;
- historical ADP never replaces current-year ADP.

These caps remain in the research implementation, but `HISTORICAL_ADP_REACH_ENABLED` is currently `false`, so live `reachAdjustment` is zero.

## Backtest result

Chronological walk-forward testing used 2018 as the first training season and predicted 2019–2025 without using future seasons.

Across 964 out-of-sample skill-position picks:

| Metric | Neutral manager | V2 |
| --- | ---: | ---: |
| MAE | 10.486 | 10.580 |
| RMSE | 15.618 | 15.604 |
| Prediction correlation | — | 0.082 |

MAE was 0.89% worse with V2. The tiny 0.09% RMSE improvement and weak correlation are not enough to justify live scoring weight. V2 also worsened MAE in five of seven test seasons.

Accordingly, the live model retains V1 and disables V2 reach/wait pressure.

## Explainability

V1 can still surface reasons such as:

```text
Armando historically leans TE in this draft phase
```

V2 research can describe reach profiles, but statements such as:

```text
Juan historically reaches for TE ahead of league ADP
```

must not currently be used as a live recommendation reason because the reach signal is disabled.

## Future calibration

Any replacement V2 formulation must beat the neutral-manager baseline chronologically before being enabled.

Promising next tests include:

- direct classification of whether a player survives to the user's next pick;
- conditioning manager behavior on current roster need;
- recent two- or three-season windows;
- player archetypes when sample size supports them;
- hierarchical uncertainty/shrinkage;
- manager-specific effects only after independent validation.
