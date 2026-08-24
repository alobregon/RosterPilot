# Opponent Survival Walk-Forward Backtest

## Decision

The direct survival backtest supports three release decisions:

1. **Market position plus distance to the user's next pick is the essential baseline.**
2. **Opponent roster need adds substantial predictive value and should remain a primary Future Availability input.**
3. **V1 phase-relative positional history adds a small but repeatable improvement and may remain active only as a bounded tie-breaker.**
4. **Manager reach/wait history and raw manager identity do not add reliable value and remain disabled for live scoring.**

This test is intentionally aligned to the product question:

> If I pass on this player now, does the player survive through the actual opponents before my next pick?

## Data

The backtest uses:

- corrected Purple League player-level draft history;
- FantasyPros Overall ADP `AVG` for 2018–2025;
- QB/RB/WR/TE candidates;
- ten-team snake-draft order;
- chronological training only.

For every historical manager pick that has a later pick in the same draft, the test treats that manager as the focal user.

At the focal pick:

1. players already drafted are removed;
2. the player actually selected at the focal pick is excluded because the historical draft does not tell us what would have happened if that player had been passed;
3. the top available candidates by historical FantasyPros ADP are evaluated;
4. a candidate receives `survive = 1` if no opponent selects the candidate before the focal manager's next pick.

The main analysis uses the top 12 available candidates. Top-8 and top-20 candidate pools are used as sensitivity checks.

## No future-roster leakage

Opponent roster-need features use only roster state known at the focal pick.

The test does **not** use the actual selections that opponents later make between the focal pick and return pick when calculating their roster need. The only future information used is the known snake-draft order and the factual survival label after the prediction window closes.

Historical tendency features for a sample from season `Y` use only seasons before `Y`.

## Walk-forward protocol

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

Future seasons are never used to construct features or train the classifier for an earlier season.

The main top-12 evaluation contains 12,600 out-of-sample candidate predictions across 1,050 historical draft decisions.

## Models

The models are deliberately incremental.

### A — ADP market position

Uses the candidate's ADP distance from the current overall pick plus candidate position.

### B — ADP + return distance

Adds the number of picks until the focal manager's next selection.

### C — + opponent roster need

Adds candidate-position need among the opponents drafting before the return pick, using only roster state available at the focal pick.

Features include average need, maximum need, and number of strong-need opponent opportunities.

### D — + V1 positional history

Adds prior-season, phase-relative manager position tendencies for the actual opponents in the prediction window.

The historical tendency is calculated only from seasons before the sample season and remains relative to the Purple League average for the same draft phase and position.

### E — + manager reach / identity research

Separate ablations test:

- historical ADP reach/wait features;
- raw opponent-manager identity opportunity counts;
- both together.

These features are research-only and are not active in live recommendations.

## Main top-12 results

Lower Brier score, log loss, and calibration error are better. Higher ROC AUC is better.

| Model | Brier | Log loss | ROC AUC | Calibration error |
| --- | ---: | ---: | ---: | ---: |
| A — ADP market position | 0.21672 | 0.62284 | 0.66837 | 0.04624 |
| B — + return distance | 0.17125 | 0.51453 | 0.81168 | 0.03189 |
| C — + roster need | 0.15019 | 0.45446 | 0.85535 | 0.03151 |
| D — + V1 positional history | **0.14943** | **0.45270** | **0.85580** | **0.02472** |
| E1 — + reach history | 0.15052 | 0.45542 | 0.85355 | 0.02485 |
| E2 — + raw manager identity | 0.15686 | 0.47358 | 0.84291 | 0.02915 |
| E3 — + reach + identity | 0.15766 | 0.47564 | 0.84138 | 0.02912 |

## What actually matters

### Return distance is highly predictive

Adding the number of picks until the user's return materially improves the ADP baseline:

```text
Brier: 0.21672 -> 0.17125
```

That is expected: a player's ADP is not meaningful for survival without knowing how many selections the player must survive.

### Opponent roster need is the strongest added signal

Adding known opponent roster state improves Brier from:

```text
0.17125 -> 0.15019
```

That is a **12.29% relative Brier improvement** over the ADP + distance baseline.

Roster need is therefore much more important to Future Availability than manager-specific reach history.

### V1 history helps, but only modestly

Adding V1 positional history improves Brier from:

```text
0.15019 -> 0.14943
```

That is a **0.51% relative improvement**.

Log loss also improves from `0.45446` to `0.45270`, calibration error improves from `0.03151` to `0.02472`, and ROC AUC changes only slightly from `0.85535` to `0.85580`.

The correct interpretation is not that V1 is a strong predictor. It is that V1 contains a small amount of incremental information after market position, return distance, and roster need are already known.

## V1 season stability

For the main top-12 pool, V1 improves Brier versus the roster-need model in five of seven test seasons:

| Season | Roster need | + V1 | Result |
| --- | ---: | ---: | --- |
| 2019 | 0.16092 | 0.15983 | better |
| 2020 | 0.14526 | 0.14492 | better |
| 2021 | 0.14488 | 0.14512 | worse |
| 2022 | 0.14727 | 0.14545 | better |
| 2023 | 0.16189 | 0.15996 | better |
| 2024 | 0.14505 | 0.14104 | better |
| 2025 | 0.14607 | 0.14967 | worse |

V1 therefore has some persistence, but its gain is not universal.

## Decision-block bootstrap

Candidate predictions within one historical draft decision are correlated, so a naive row-level confidence interval would overstate certainty.

For the main top-12 model, a paired bootstrap resampled the 1,050 historical draft decisions as blocks and compared V1 against the roster-need model.

Mean Brier difference:

```text
V1 - roster need = -0.000767
```

95% decision-block bootstrap interval:

```text
[-0.00136, -0.00018]
```

V1 improved the mean Brier score in approximately 59.7% of historical decision blocks.

This supports a small incremental signal, but the interval does not account for every source of model-selection or hyperparameter uncertainty. It should not be interpreted as evidence for a large effect.

## Candidate-pool sensitivity

The V1 result is not unique to choosing exactly 12 candidates.

| Candidate pool | ADP + distance Brier | + roster need | + V1 | Roster-need gain | Additional V1 gain |
| --- | ---: | ---: | ---: | ---: | ---: |
| Top 8 available | 0.16615 | 0.14542 | 0.14456 | 12.48% | 0.59% |
| Top 12 available | 0.17125 | 0.15019 | 0.14943 | 12.29% | 0.51% |
| Top 20 available | 0.16391 | 0.15093 | 0.15040 | 7.92% | 0.35% |

Across all three candidate pools:

- roster need produces a substantial improvement;
- V1 produces a much smaller additional improvement;
- the incremental V1 effect decreases as the candidate pool broadens.

## Manager reach and identity remain unsupported

Starting from the validated roster + V1 model:

```text
V1 Brier:                   0.14943
+ historical reach:        0.15052
+ raw manager identity:    0.15686
+ both:                    0.15766
```

Historical reach makes the prediction slightly worse. Raw manager identity makes it materially worse, especially when early walk-forward folds contain only a small number of prior seasons.

This confirms the earlier V2 reach backtest decision: do not activate those signals merely because they are available.

## Release interpretation

The current evidence supports the following hierarchy for Future Availability:

```text
market ADP / current draft position
        ↓
number of picks to survive
        ↓
opponent roster needs
        ↓
small V1 positional-history tie-breaker
```

Manager reach history and raw identity should contribute zero live weight.

V1 should **not** be promoted to a large scoring component. Its current design is appropriate only because the live recommendation engine already constrains historical influence to Future Availability and caps the maximum recommendation-score impact below one raw point.

## Next modeling step

The next useful improvement is calibration of the direct survival probability itself rather than adding more manager-history features.

Potential work:

1. expose a calibrated `P(player survives to next pick)` estimate;
2. compare logistic, isotonic, and simple empirical calibration;
3. test roster need by position and round without increasing manager-specific complexity;
4. validate whether recent live draft trends add incremental out-of-sample value;
5. reserve manager-specific features for future tests only when they beat the roster + V1 baseline chronologically.
