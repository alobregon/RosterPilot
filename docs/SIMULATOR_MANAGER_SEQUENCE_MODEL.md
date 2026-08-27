# Simulator manager sequence model

## Purpose

Historical manager personalization in Draft Simulator should represent **conditional draft behavior**, not merely a manager's broad position preference.

A phase-level statement such as "this manager drafts RB more often than the league in Rounds 1-4" is useful before the draft starts, but it becomes too coarse once that manager has already made selections. A manager who generally favors RB early should not receive the same RB boost after RB-RB that they received before making any picks.

The sequence model therefore conditions the historical position distribution on the manager's actual simulated roster sequence while keeping the current-year market/ranking board dominant.

## Source data

Sequence statistics were derived from the corrected Purple League draft history covering 2013-2025. The raw draft-history export remains outside the repository. Only the compact derived artifact is committed:

`research/league_manager_sequence_profiles_2013_2025.json`

The derivation uses the same recency decay as the existing V1 manager profile:

```text
season weight = 0.85 ^ (2025 - season)
```

The derived artifact contains, per manager:

- exact first-four prefix transitions, such as `RB>RB -> next position`;
- recency-weighted same-position repeat behavior in Rounds 2-8;
- recency-weighted probability of extending a two-pick same-position streak in Rounds 3-8.

Player identity and historical ADP reach/wait behavior are deliberately excluded.

## Hierarchical backoff

For a simulated opponent pick with an assigned historical manager, the position distribution is built from broad to specific:

1. **Draft-phase position tendency** from the existing V1 profile (`R1_4`, `R5_8`, `R9_12`, `R13_16`).
2. **Same-position repeat behavior** when the manager already has a prior pick, shrunk toward the phase distribution with prior weight 6.
3. **Two-pick streak continuation behavior** when the previous two picks have the same position, shrunk toward the repeat-conditioned distribution with prior weight 4.
4. **Exact early-draft prefix** in Rounds 2-4 when that exact prior sequence exists historically, shrunk toward the broader conditional distribution with prior weight 3.

This ordering matters: sequence information **replaces/refines** the coarse phase tendency instead of being added as a second independent bonus. That prevents double-counting statements such as "likes RB early" and "has already taken RB twice."

The resulting effective position probability is then compared with the league's phase-level probability and converted into the existing bounded manager-history score. The simulator still considers only the top 12 current market candidates, so sequence history cannot create extreme reaches.

## Sunny-D RB-RB example

The corrected history shows that Sunny-D started a draft RB-RB five times from 2013-2025. The third pick in those drafts was:

- WR: 3 times;
- RB: 1 time;
- QB: 1 time.

With the 0.85 recency decay, the raw conditional distribution after an `RB>RB` start is approximately:

| Next position | Raw recency-weighted share |
| --- | ---: |
| WR | 56.3% |
| QB | 25.3% |
| RB | 18.3% |

After hierarchical shrinkage through repeat/streak behavior and the broader R1-4 tendency, the simulator's effective Round 3 distribution is approximately:

| Next position | Effective probability |
| --- | ---: |
| WR | 54.6% |
| RB | 26.8% |
| QB | 17.5% |
| TE | 1.1% |

So RB-RB-RB remains possible, because it has occurred historically, but it is no longer treated as the natural consequence of Sunny-D's broad early-RB preference. In a close current-year market decision, WR should generally gain the historical edge after an RB-RB start.

## Live scoring hierarchy

Historical sequence behavior remains a bounded tie-breaker. Simulated opponent selection still uses this hierarchy:

1. current ranking / ADP market order;
2. current roster need;
3. sequence-conditioned manager tendency;
4. optional room-profile pressure;
5. small deterministic jitter for close ties.

The candidate window remains the top 12 current market players.

## What this does not change

This model affects **simulated opponent selections only** when Historical manager data is enabled.

It does not enter the calibrated **chance back by #N** probability. The displayed survival probability continues to use the validated Model C inputs (market ADP, distance to return pick, position, and opponent roster need), because raw manager identity and historical reach/wait behavior did not improve chronological out-of-sample calibration.

Historical player-level reach/wait remains disabled.
