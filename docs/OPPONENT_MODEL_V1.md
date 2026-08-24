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

Historical ADP research now exists separately in `research/league_manager_adp_profiles_2018_2025.json`, but the reach/wait component failed its independent release criterion and is disabled in live recommendations. V1 remains strictly positional and phase-relative.

## Manager selection and matching

League setup exposes an optional **Historical managers** selector for every draft slot. Each selection stores the stable manager ID from the research profile rather than depending on a current fantasy team name.

The selector shows:

- manager display name;
- known 2025 team name;
- number of seasons represented in the draft-history profile.

Duplicate manager assignments are disabled in the setup UI. Assigning the user's own slot is optional because opponent modeling ignores the user's picks.

Explicit manager IDs are authoritative. For backward compatibility with older saves and manual team labels, V1 can still fall back to matching a team label against:

1. manager ID;
2. manager display name;
3. known 2025 team name.

Fallback matching ignores punctuation, spaces, capitalization, and accents. Generic labels such as `Team 8` do not activate historical modeling.

Manager assignments are persisted in browser storage and JSON backups. Older V1 backups that predate the selector restore with all manager assignments unassigned rather than becoming invalid.

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

## Direct survival validation

V1 has now been evaluated against the product question directly rather than only as descriptive historical research.

A chronological walk-forward backtest used 2018–2025 Purple League drafts and historical FantasyPros ADP. At every historical draft decision, available candidates were labeled according to whether they survived through the actual opponents before the focal manager's next pick.

The main top-12 candidate analysis produced 12,600 out-of-sample predictions across 1,050 historical draft decisions.

Key Brier scores:

```text
ADP + return distance                  0.17125
+ opponent roster need                0.15019
+ V1 phase-relative positional history 0.14943
```

Opponent roster need is the dominant incremental signal, improving Brier by 12.29% relative to the ADP + distance baseline.

V1 adds only a **0.51% relative Brier improvement** beyond roster need. Log loss and calibration also improve modestly, while ROC AUC is nearly unchanged.

The V1 gain is small but directionally robust across candidate-pool sensitivity checks:

```text
Top 8:  +0.59% relative Brier improvement
Top 12: +0.51%
Top 20: +0.35%
```

On the main top-12 test, V1 improves Brier in five of seven test seasons. A paired decision-block bootstrap produced a mean V1-minus-roster Brier difference of `-0.000767` with a 95% interval of `[-0.00136, -0.00018]`.

The correct release interpretation is that V1 contains a **small tie-breaker signal**, not that manager history is a strong predictor.

See `docs/OPPONENT_SURVIVAL_BACKTEST.md` for the full protocol, metrics, ablations, and limitations.

## Explainability

When a matched manager creates meaningful positive pressure, the recommendation explanation can surface text such as:

```text
Armando historically leans TE in this draft phase
```

Negative historical pressure is used internally to modestly increase the chance that a player survives, but V1 does not clutter the Top 3 explanation list with every low-probability manager signal.

## Safety rails

Opponent Model V1 is intentionally bounded:

- no explicit manager assignment or fallback label match → zero adjustment;
- no return pick → zero adjustment;
- imported overall ranking is never modified;
- ADP/market-fall logic is unchanged;
- recommendation strategy is unchanged;
- roster legality is unchanged;
- maximum Future Availability adjustment is ±14;
- maximum raw recommendation-score effect is <1 point;
- historical ADP reach/wait scoring is disabled after failing walk-forward validation.

## Current limitation

V1 remains a coarse phase/position model. It does not estimate a manager-specific probability of selecting an individual player, and it does not condition historical tendencies on the opponent's current roster state.

The direct survival backtest shows that roster state is materially more predictive than manager history, so any future opponent-model work should preserve that ordering of importance.

## Next evolution

Future work should prioritize:

- calibrated direct `P(player survives to next pick)` estimates;
- roster-state-conditioned opponent behavior;
- validation of recent positional-run signals;
- uncertainty-aware historical priors;
- manager-specific features only after they beat the roster + V1 baseline on chronological out-of-sample data.
