# Simulator manager sequence model

## Purpose

Historical manager personalization in Draft Simulator should represent **conditional draft behavior**, not merely a manager's broad position preference.

A phase-level statement such as "this manager drafts RB more often than the league in Rounds 1-4" is useful as a broad prior, but it is too coarse for the manager's first pick and becomes too coarse again once that manager has already made selections. Round 1 therefore uses its own recency-weighted first-pick distribution, while later early-round picks condition on the manager's actual simulated roster sequence.

The sequence model keeps the current-year market/ranking board as the anchor while allowing manager-specific behavior more latitude as ranking precision naturally declines later in the draft.

## Source data

Statistics were derived from the corrected Purple League draft history covering 2013-2025. The raw draft-history export remains outside the repository. Compact derived artifacts are committed:

- `research/league_manager_round1_profiles_2013_2025.json`
- `research/league_manager_sequence_profiles_2013_2025.json`

The derivation uses the same recency decay as the existing V1 manager profile:

```text
season weight = 0.85 ^ (2025 - season)
```

The Round-1 artifact contains each manager's recency-weighted first-pick position distribution. The sequence artifact contains, per manager:

- exact first-four prefix transitions, such as `RB>RB -> next position`;
- recency-weighted same-position repeat behavior in Rounds 2-8;
- recency-weighted probability of extending a two-pick same-position streak in Rounds 3-8.

Player identity and historical ADP reach/wait behavior are deliberately excluded.

## Hierarchical backoff

For a simulated opponent pick with an assigned historical manager, the position distribution is built as follows:

1. **Round 1:** dedicated recency-weighted first-pick tendency, compared with the league's recency-weighted Round-1 manager baseline.
2. **Round 2 onward:** draft-phase position tendency from the existing V1 profile (`R1_4`, `R5_8`, `R9_12`, `R13_16`).
3. **Same-position repeat behavior** when the manager already has a prior pick, shrunk toward the phase distribution with prior weight 6.
4. **Two-pick streak continuation behavior** when the previous two picks have the same position, shrunk toward the repeat-conditioned distribution with prior weight 4.
5. **Exact early-draft prefix** in Rounds 2-4 when that exact prior sequence exists historically, shrunk toward the broader conditional distribution with prior weight 3.

This ordering matters: sequence information **replaces/refines** the coarse phase tendency instead of being added as a second independent bonus. Round 1 likewise no longer inherits a manager's combined Rounds 1-4 preference. That prevents a manager who accumulates RBs across Rounds 2-4 from being incorrectly treated as an unusually strong Round-1 RB drafter.

## Round-dependent market tolerance

The confidence gap between adjacent rankings is not constant across a draft. The live simulator therefore widens its allowable market deviation as the draft progresses.

| Rounds | Candidate window | Market-slot penalty | Manager-position cap | Seeded variation |
| --- | ---: | ---: | ---: | ---: |
| 1 | 10 | 3.00 | ±3 | ±1.5 |
| 2–4 | 12 | 2.50 | ±5 | ±1.5 |
| 5–8 | 16 | 1.75 | ±7 | ±2.0 |
| 9–12 | 20 | 1.25 | ±9 | ±2.5 |
| 13–16+ | 24 | 0.90 | ±10 | ±3.0 |

This matters because simply enlarging the candidate window would not be enough: with a fixed 3-point penalty per market slot, a late-round candidate 15 slots down would almost never be able to overcome the market score. The declining slot penalty is what makes a broader late-round candidate window behaviorally meaningful.

The widening is still bounded. Even in the final rounds, historical behavior cannot select outside the top 24 currently available market candidates, and historical player-level reach/wait remains disabled.

## Round 1 guardrail

Round 1 has less conditional information than later picks because the manager has not built any sequence yet. To keep the current board authoritative, the Round-1 manager-position adjustment is capped at **±3 score points** before the standard history weight is applied.

This means a strong first-pick preference can break a close RB/WR decision, but it should not routinely erase several market slots. Round 1 also retains the steepest 3-point market penalty per candidate slot and the narrowest 10-player candidate window.

## Per-mock variation

Each newly started simulation receives a fresh random run seed. The seed is stored with the draft configuration and drives bounded close-call variation.

The important behavior is:

- the same mock and same seed produce the same opponent choice from the same state;
- refreshing or restoring that mock keeps the seed and therefore keeps future close choices stable;
- restarting and starting a new simulation generates a new seed;
- a new seed can change genuinely close choices, but it cannot overcome large current-market gaps by itself;
- the variation widens from **±1.5 in Round 1 to ±3.0 in Rounds 13+**, reflecting greater late-round uncertainty.

This provides draft-to-draft variety without turning opponent selection into unrestricted randomness.

## Sunny-D Round 1 example

Sunny-D's broad recency-weighted Rounds 1-4 profile is approximately **56.7% RB / 35.2% WR**, but that is not the correct comparison for his first pick.

Using only his actual Round-1 selections with the same 0.85 recency decay gives approximately:

| Position | Sunny-D Round 1 | League manager Round 1 average |
| --- | ---: | ---: |
| RB | 58.8% | 55.9% |
| WR | 41.2% | 41.1% |

The manager-specific signal at his first pick is therefore small. On the 2026 board where Puka Nacua is the top remaining market player and Christian McCaffrey is several market slots lower, Round-1 history should not overpower the current board.

## Dixie Round 1 example

Dixie has a much stronger legitimate first-pick RB history: approximately **69.9% RB / 30.1% WR** after recency weighting, versus a league Round-1 average around **55.9% RB / 41.1% WR**.

That should make Dixie more likely than most managers to take an RB when the values are close. The ±3 Round-1 cap prevents that preference from automatically moving an RB several market slots ahead of a clearly stronger current-year WR. Because the per-mock variation is small, a borderline choice can differ between mocks while the current market remains the dominant signal.

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

Historical behavior remains bounded. Simulated opponent selection uses this hierarchy:

1. current ranking / ADP market order;
2. generic current roster need;
3. Round-1 or sequence-conditioned manager tendency;
4. manager-specific historical roster construction;
5. optional room-profile pressure;
6. per-mock seeded variation.

The relative authority of the first item is strongest in Round 1 and progressively relaxes through the candidate-window and market-slot-penalty curve above.

## What this does not change

This model affects **simulated opponent selections only** when Historical manager data is enabled.

It does not enter the calibrated **chance back by #N** probability. The displayed survival probability continues to use the validated Model C inputs (market ADP, distance to return pick, position, and opponent roster need), because raw manager identity and historical reach/wait behavior did not improve chronological out-of-sample calibration.

Historical player-level reach/wait remains disabled.
