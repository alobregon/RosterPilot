# Calibrated Player Survival Probability

## Purpose

Draft Companion now exposes a separate probability for the question:

> If I pass on this player now, what is the probability the player is still available at my next pick?

This is intentionally different from **Recommendation %**.

- `Recommendation %` is relative preference among the three players currently recommended.
- `Chance back by #N` is an absolute, historically calibrated estimate of player survival to the user's following pick.

The two values must not be interpreted as the same quantity.

## Released model

The released survival model uses only the strongest predictors supported by the direct chronological backtest:

1. candidate ADP relative to the current pick;
2. number of picks the candidate must survive;
3. candidate position;
4. average opponent roster need for that position;
5. maximum opponent roster need;
6. number of strong-need opponent pick opportunities.

Manager identity and historical reach/wait behavior are deliberately excluded from the displayed probability because they worsened out-of-sample survival prediction.

V1 phase-relative positional history remains a separate, bounded recommendation tie-breaker. It is not presented as part of the calibrated percentage.

## Training data

The final probability model is fit on the 2018–2025 Purple League survival dataset used by `docs/OPPONENT_SURVIVAL_BACKTEST.md`.

For each historical draft decision:

- already-drafted players are removed;
- the focal manager's actual selection is excluded;
- available QB/RB/WR/TE candidates are ranked by historical FantasyPros ADP;
- survival is `1` when the candidate remains available through all intervening opponent picks;
- opponent roster state uses only information known at the focal pick.

The primary training pool uses the top 12 available market candidates. Sensitivity testing showed the same feature hierarchy at top 8 and top 20.

## Base classifier

The deployed base classifier is logistic regression using the same Model C feature set from the direct survival study:

```text
ADP relative to current pick
+ return distance
+ candidate position
+ average opponent need
+ maximum opponent need
+ strong-need opportunity count
```

Numeric features are standardized using the 2018–2025 training distribution. The fitted coefficients are stored directly in `apps/draft-companion/lib/survival.ts` so draft-night inference remains deterministic and browser-local.

No LLM, network call, or runtime model training is required.

## Probability calibration

Raw logistic probabilities were already reasonably calibrated, but an additional Platt-scaling layer was evaluated because the product displays an explicit probability to the user.

Calibration methods considered:

- raw logistic probability;
- Platt scaling;
- isotonic calibration.

Chronological out-of-fold predictions from 2019–2025 were used to evaluate calibration behavior.

Platt scaling was selected because it improved calibration error without producing the overconfident 0%/100% outputs observed with isotonic calibration.

Approximate out-of-sample Model C results:

| Metric | Raw logistic | Sequential Platt |
| --- | ---: | ---: |
| Brier | 0.15007 | 0.15010 |
| Log loss | 0.45402 | 0.45367 |
| 10-bin calibration error | 0.0312 | 0.0217 |

Platt scaling therefore preserves discrimination and overall Brier performance while making the displayed probabilities better aligned with observed frequencies.

The final Platt mapping is fit on the complete set of chronological 2019–2025 out-of-fold predictions, then applied to the final 2018–2025 base model for 2026 inference.

## Validated domain

The survival percentage is shown only when all of the following are true:

- the candidate is QB, RB, WR, or TE;
- current ADP is available;
- the user has a later pick in the draft;
- the candidate is within the top 20 currently available players by ADP.

The top-20 boundary is deliberate. The survival backtest explicitly checked top-8, top-12, and top-20 candidate pools. Draft Companion returns no calibrated probability outside that range rather than extrapolating the model into an untested part of the player pool.

K and DST continue to use the existing availability logic because the calibrated model was not trained for those positions.

## Live recommendation integration

When a calibrated survival probability is available:

```text
base Future Availability urgency = (1 - survival probability) * 100
```

The existing V1 historical position signal may then make its already-bounded small adjustment to Future Availability.

The recommendation engine still weights Future Availability at only 5%, so the calibrated survival model informs close decisions without replacing the user's rankings, roster fit, tiers, or strategy.

When the survival model is not eligible, Draft Companion falls back to the existing deterministic Future Availability heuristic.

## UI contract

On-clock cards may show, for example:

```text
Recommendation: 47%
72% chance back by #34
```

These mean:

- `47%` — this player receives 47% of the relative preference share across the displayed Top 3;
- `72% chance back by #34` — the calibrated model estimates a 72% chance the player remains available at pick 34 if passed now.

The return probability tooltip states that it is based on historical market ADP, picks to survive, and opponent roster need, and that manager identity is excluded from the percentage.

## Safety / interpretation

The survival percentage is an empirical model estimate, not a guarantee.

It should be treated as most useful when comparing close draft choices:

- low survival probability can justify taking a desired player now;
- high survival probability can support waiting while selecting another need/value;
- recommendation strength should still determine whether the player is worth drafting at all.

Future models should continue to require chronological out-of-sample improvement before new features are allowed to change the displayed probability.
