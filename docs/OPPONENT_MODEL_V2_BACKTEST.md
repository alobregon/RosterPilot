# Opponent Model V2 Walk-Forward Backtest

## Decision

**Historical ADP reach/wait behavior is retained as research data but disabled in live Draft Companion recommendations.**

The first walk-forward validation did not show enough out-of-sample predictive value to justify giving the V2 reach signal live scoring weight.

V1 phase-relative positional tendencies remain active. This report evaluates only the additional V2 manager-relative ADP reach/wait signal.

A later direct survival backtest reached the same conclusion for V2 reach history while finding a small incremental benefit from V1 positional history. See `docs/OPPONENT_SURVIVAL_BACKTEST.md`.

## Question

Does knowing a manager's prior reach/wait behavior relative to FantasyPros ADP improve prediction of that manager's future deviation from the Purple League?

The release criterion is intentionally simple:

> V2 should beat a neutral-manager baseline out of sample before it can affect live Future Availability.

## Data

Historical inputs:

- corrected Purple League player-level draft history;
- FantasyPros Overall ADP `AVG` for 2018–2025;
- QB/RB/WR/TE only.

The backtest uses the exact matching policy behind `research/league_manager_adp_profiles_2018_2025.json`:

- 1,100 / 1,115 historical skill-position picks matched overall;
- 2018 is the first training season;
- 2019–2025 provide 964 out-of-sample test picks.

No unmatched player is force-matched.

## Target

For each matched historical pick:

```text
adp_delta = actual_overall_pick - FantasyPros_AVG_ADP
```

Then, within the same season, draft phase, and position:

```text
league_relative_delta = manager_adp_delta - league_mean_adp_delta
```

The prediction target is `league_relative_delta`.

A negative value means the manager selected earlier than the Purple League normally did relative to market ADP. A positive value means the manager waited longer.

## Walk-forward protocol

This is chronological validation, not random cross-validation.

For each test season:

```text
2019: train 2018
2020: train 2018-2019
2021: train 2018-2020
2022: train 2018-2021
2023: train 2018-2022
2024: train 2018-2023
2025: train 2018-2024
```

Future seasons are never used to predict an earlier season.

The tested V2 formula matches the research scorer:

```text
45% manager overall behavior
35% manager + position behavior
20% manager + draft-phase behavior
```

Historical observations use:

- 0.85 annual recency decay;
- an eight-pick equivalent neutral prior for shrinkage;
- a ±6-pick cap on the effective ADP shift.

## Baseline

The neutral-manager baseline predicts:

```text
league_relative_delta = 0
```

In other words, current market ADP and league behavior are allowed to stand on their own; the manager identity adds no reach/wait adjustment.

## Overall results

| Metric | Neutral manager | V2 | V2 change |
| --- | ---: | ---: | ---: |
| Test picks | 964 | 964 | — |
| MAE | 10.486 | 10.580 | **0.89% worse** |
| RMSE | 15.618 | 15.604 | 0.09% better |
| Prediction correlation | — | 0.082 | weak |

The tiny RMSE improvement is not enough to offset the worse typical absolute error. The signal does not meet the release criterion.

## Results by test season

| Season | N | Baseline MAE | V2 MAE | V2 MAE change |
| --- | ---: | ---: | ---: | ---: |
| 2019 | 136 | 11.309 | 11.256 | 0.47% better |
| 2020 | 139 | 12.264 | 12.528 | 2.15% worse |
| 2021 | 137 | 11.383 | 11.093 | 2.55% better |
| 2022 | 139 | 10.099 | 10.399 | 2.97% worse |
| 2023 | 136 | 10.377 | 10.669 | 2.81% worse |
| 2024 | 138 | 8.017 | 8.118 | 1.26% worse |
| 2025 | 139 | 9.965 | 10.001 | 0.36% worse |

V2 worsens MAE in five of seven test seasons.

## Results by position

| Position | N | Baseline MAE | V2 MAE | V2 improvement |
| --- | ---: | ---: | ---: | ---: |
| QB | 89 | 11.388 | 11.610 | 1.95% worse |
| RB | 346 | 10.072 | 10.217 | 1.44% worse |
| TE | 110 | 12.092 | 11.934 | **1.30% better** |
| WR | 419 | 10.215 | 10.304 | 0.87% worse |

TE is the only position with a modest aggregate improvement. That is not sufficient evidence for a general live reach model.

## Results by manager

The model shows pockets of persistence but not enough consistency across the league.

| Manager | N | Baseline MAE | V2 MAE | V2 improvement |
| --- | ---: | ---: | ---: | ---: |
| Ryan | 95 | 9.295 | 8.836 | **4.94% better** |
| PJ | 98 | 8.624 | 8.316 | **3.58% better** |
| Armando | 95 | 10.515 | 10.545 | 0.29% worse |
| Juan | 98 | 13.394 | 13.449 | 0.41% worse |
| Juan Urtecho | 97 | 10.773 | 10.860 | 0.81% worse |
| Alvaro Obregon | 98 | 11.494 | 11.671 | 1.54% worse |
| Sunny-DCommissioner | 97 | 8.693 | 8.865 | 1.98% worse |
| Dixie | 94 | 9.602 | 9.850 | 2.58% worse |
| Hansel | 96 | 11.155 | 11.583 | 3.83% worse |
| Alex | 96 | 11.261 | 11.768 | 4.50% worse |

Manager-specific improvements for Ryan and PJ are interesting research leads, but enabling per-manager exceptions from this same sample would risk overfitting. They remain disabled until independently validated.

## Why the signal stays disabled

The Draft Companion should not reward a sophisticated-looking feature merely because historical profiles can be calculated.

The current evidence says:

- manager reach/wait behavior is noisy year to year;
- the V2 point prediction adds very little correlation with future behavior;
- typical absolute error gets slightly worse;
- improvement is not stable across seasons or positions.

Accordingly, `HISTORICAL_ADP_REACH_ENABLED` is `false` in the live opponent model.

The derived ADP profiles and `historicalAdpShift()` scorer remain in the codebase for research and future calibration, but `reachAdjustment` is forced to zero in live recommendations.

## Confirmation from direct survival prediction

A second chronological experiment tested the actual product target: whether an available player survives through the opponents before the focal manager's next pick.

Starting from a model that already included ADP, return distance, opponent roster need, and V1 positional history:

```text
V1 model Brier:             0.14943
+ historical reach Brier:  0.15052
```

Historical reach again made predictions worse. Adding raw manager identity was worse still.

This independent target reinforces the decision to keep V2 reach scoring disabled.

## What remains active

Opponent Model V1 remains active and continues to use bounded phase-relative positional tendencies for Future Availability.

The historical-manager selector remains useful because it supplies stable identity for V1 and future validated models.

## Next research candidates

Before reconsidering the reach signal, test one or more materially different formulations rather than tuning the current coefficients against the same holdout results:

1. **Calibrated direct survival probability** — build on the validated roster + V1 survival model.
2. **Roster-state-conditioned tendencies** — historical manager behavior only when the manager currently needs the candidate's position.
3. **Recent-window behavior** — test whether only the last two or three seasons are predictive.
4. **Player archetypes** — rookie, veteran, elite TE, QB tier, handcuff, etc., if sample sizes support them.
5. **Hierarchical uncertainty** — explicitly shrink manager/position effects based on sample size rather than treating all profile shifts as equally reliable.
6. **Predeclared per-manager validation** — only after a separate validation period exists; do not enable manager-specific exceptions from this backtest alone.

Any future manager-history candidate should beat the roster + V1 survival baseline on chronological out-of-sample data before affecting live recommendations.
