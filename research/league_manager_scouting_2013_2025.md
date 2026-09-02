# Purple League Manager Scouting Report (2013–2025)

This report summarizes draft-position behavior for the 10 current managers using the corrected 2013–2025 league history. Juan has 12 seasons (2014–2025); the other nine current managers have 13. `--hidden--` is a former 2013-only member and is excluded from current-manager profiles.

## 2025 identity correction

The 2025 team-to-manager mapping used for this report is:

| 2025 team | Manager |
|---|---|
| Dildo Year | Dixie |
| Me Lo Paro- Now it Hurts | Juan |
| Emeka Wish Foundation | Alvaro Obregon |
| The Kittle Engine that Could | Armando |
| Taylor-Made | Sunny-DCommissioner |
| Run like Achane-telope | Hansel |
| Nthin Beats a JJettas Holiday✈ | Juan Urtecho |
| It’s Gonna Be Maye | PJ |
| My Arrakis My ODUNZE | Alex |
| Hijo de la Gran Puka! | Ryan |

## Modeling rules

- Use **round/position probabilities** as manager-specific priors.
- Use **QB/TE timing** as a hazard feature that increases as a manager approaches their historical selection window.
- Use **current roster state** to modify the prior rather than treating history as a fixed script.
- Use **run-response lift** only as a soft contextual modifier. It compares whether a manager followed a position that appeared at least twice in the previous three league picks against that manager's normal position mix for the same draft phase.
- Weight recent seasons more heavily. The machine-readable profile uses `0.85^(2025-season)`.
- Do **not** estimate reach tolerance yet. Historical ADP/ECR has not been joined, so player-level reach/value behavior is not yet identifiable.

## Current managers at a glance

| Manager | 2025 team | Drafts | R1 RB | R1 WR | First QB | First TE | Run response | Same-pos repeat R2–8 |
|---|---|---:|---:|---:|---:|---:|---|---:|
| Dixie | Dildo Year | 13 | 76.9% | 23.1% | R9 | R6 | Neutral (-0.7 pp) | 36.3% |
| Sunny-DCommissioner | Taylor-Made | 13 | 53.8% | 46.2% | R8 | R8 | Neutral (-2.2 pp) | 39.6% |
| PJ | It’s Gonna Be Maye | 13 | 46.2% | 38.5% | R5 | R8 | Neutral (+4.3 pp) | 17.6% |
| Juan Urtecho | Nthin Beats a JJettas Holiday✈ | 13 | 46.2% | 53.8% | R8 | R8 | Neutral (-2.1 pp) | 18.7% |
| Ryan | Hijo de la Gran Puka! | 13 | 53.8% | 46.2% | R6 | R6 | Neutral (+2.9 pp) | 31.9% |
| Armando | The Kittle Engine that Could | 13 | 53.8% | 30.8% | R7 | R4 | Fades (-9.1 pp) | 24.2% |
| Hansel | Run like Achane-telope | 13 | 53.8% | 46.2% | R6 | R8 | Chases (+6.8 pp) | 25.3% |
| Juan | Me Lo Paro- Now it Hurts | 12 | 75.0% | 16.7% | R5.5 | R5.5 | Chases (+5.4 pp) | 21.4% |
| Alvaro Obregon | Emeka Wish Foundation | 13 | 61.5% | 38.5% | R8 | R6 | Neutral (+1.6 pp) | 25.3% |
| Alex | My Arrakis My ODUNZE | 13 | 76.9% | 23.1% | R9 | R8 | Neutral (+3.3 pp) | 23.1% |

## Manager profiles

### Dixie — Dildo Year

- Round 1: 76.9% RB, 23.1% WR.
- Rounds 1–4 are **RB**: 50.0% RB vs 40.4% WR.
- Typical first QB: Round 9; QB selected by Round 5 in 23.1% of drafts.
- Typical first TE: Round 6; TE selected by Round 5 in 30.8% of drafts.
- Run-response signal: **Neutral (-0.7 pp)** across 143 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 36.3%.
- Most common first-four pattern: **RB-RB-WR-WR** (4 of 13 drafts).
- Career average roster: 5.4 RB, 5.9 WR, 1.2 QB, 1.4 TE.
- Recent 2021–2025 first-four mix: 50.0% RB, 35.0% WR, 0.0% QB, 15.0% TE.

### Sunny-DCommissioner — Taylor-Made

- Round 1: 53.8% RB, 46.2% WR.
- Rounds 1–4 are **RB**: 53.8% RB vs 40.4% WR.
- Typical first QB: Round 8; QB selected by Round 5 in 46.2% of drafts.
- Typical first TE: Round 8; TE selected by Round 5 in 23.1% of drafts.
- Run-response signal: **Neutral (-2.2 pp)** across 135 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 39.6%.
- Most common first-four pattern: **WR-WR-RB-RB** (3 of 13 drafts).
- Career average roster: 4.8 RB, 6.2 WR, 1.4 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 60.0% RB, 30.0% WR, 10.0% QB, 0.0% TE.

### PJ — It’s Gonna Be Maye

- Round 1: 46.2% RB, 38.5% WR, 7.7% QB, 7.7% TE.
- Rounds 1–4 are **balanced RB/WR**: 44.2% RB vs 44.2% WR.
- Typical first QB: Round 5; QB selected by Round 5 in 76.9% of drafts.
- Typical first TE: Round 8; TE selected by Round 5 in 7.7% of drafts.
- Run-response signal: **Neutral (+4.3 pp)** across 132 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 17.6%.
- Most common first-four pattern: **RB-WR-RB-WR** (3 of 13 drafts).
- Career average roster: 5.3 RB, 5.8 WR, 1.3 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 50.0% RB, 45.0% WR, 5.0% QB, 0.0% TE.

### Juan Urtecho — Nthin Beats a JJettas Holiday✈

- Round 1: 46.2% RB, 53.8% WR.
- Rounds 1–4 are **balanced RB/WR**: 46.2% RB vs 48.1% WR.
- Typical first QB: Round 8; QB selected by Round 5 in 7.7% of drafts.
- Typical first TE: Round 8; TE selected by Round 5 in 38.5% of drafts.
- Run-response signal: **Neutral (-2.1 pp)** across 153 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 18.7%.
- Most common first-four pattern: **RB-WR-RB-WR** (3 of 13 drafts).
- Career average roster: 4.8 RB, 6.2 WR, 1.2 QB, 1.7 TE.
- Recent 2021–2025 first-four mix: 45.0% RB, 45.0% WR, 0.0% QB, 10.0% TE.

### Ryan — Hijo de la Gran Puka!

- Round 1: 53.8% RB, 46.2% WR.
- Rounds 1–4 are **WR**: 34.6% RB vs 51.9% WR.
- Typical first QB: Round 6; QB selected by Round 5 in 46.2% of drafts.
- Typical first TE: Round 6; TE selected by Round 5 in 30.8% of drafts.
- Run-response signal: **Neutral (+2.9 pp)** across 138 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 31.9%.
- Most common first-four pattern: **RB-RB-WR-WR** (2 of 13 drafts).
- Career average roster: 5.1 RB, 6.2 WR, 1.3 QB, 1.4 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 50.0% WR, 5.0% QB, 5.0% TE.

### Armando — The Kittle Engine that Could

- Round 1: 53.8% RB, 30.8% WR, 15.4% TE.
- Rounds 1–4 are **balanced RB/WR**: 38.5% RB vs 38.5% WR.
- Typical first QB: Round 7; QB selected by Round 5 in 46.2% of drafts.
- Typical first TE: Round 4; TE selected by Round 5 in 76.9% of drafts.
- Run-response signal: **Fades (-9.1 pp)** across 147 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 24.2%.
- Most common first-four pattern: **RB-WR-TE-WR** (2 of 13 drafts).
- Career average roster: 4.6 RB, 5.7 WR, 1.6 QB, 1.9 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 40.0% WR, 5.0% QB, 15.0% TE.

### Hansel — Run like Achane-telope

- Round 1: 53.8% RB, 46.2% WR.
- Rounds 1–4 are **balanced RB/WR**: 40.4% RB vs 44.2% WR.
- Typical first QB: Round 6; QB selected by Round 5 in 46.2% of drafts.
- Typical first TE: Round 8; TE selected by Round 5 in 23.1% of drafts.
- Run-response signal: **Chases (+6.8 pp)** across 139 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 25.3%.
- Most common first-four pattern: **RB-RB-WR-WR** (2 of 13 drafts).
- Career average roster: 4.5 RB, 6.4 WR, 1.6 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 35.0% RB, 45.0% WR, 15.0% QB, 5.0% TE.

### Juan — Me Lo Paro- Now it Hurts

- Round 1: 75.0% RB, 16.7% WR, 8.3% QB.
- Rounds 1–4 are **WR**: 37.5% RB vs 43.8% WR.
- Typical first QB: Round 5.5; QB selected by Round 5 in 50.0% of drafts.
- Typical first TE: Round 5.5; TE selected by Round 5 in 50.0% of drafts.
- Run-response signal: **Chases (+5.4 pp)** across 131 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 21.4%.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 12 drafts).
- Career average roster: 4.5 RB, 5.6 WR, 1.8 QB, 2.1 TE.
- Recent 2021–2025 first-four mix: 35.0% RB, 45.0% WR, 15.0% QB, 5.0% TE.

### Alvaro Obregon — Emeka Wish Foundation

- Round 1: 61.5% RB, 38.5% WR.
- Rounds 1–4 are **WR**: 42.3% RB vs 48.1% WR.
- Typical first QB: Round 8; QB selected by Round 5 in 15.4% of drafts.
- Typical first TE: Round 6; TE selected by Round 5 in 38.5% of drafts.
- Run-response signal: **Neutral (+1.6 pp)** across 138 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 25.3%.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 13 drafts).
- Career average roster: 5.2 RB, 5.7 WR, 1.6 QB, 1.6 TE.
- Recent 2021–2025 first-four mix: 35.0% RB, 50.0% WR, 5.0% QB, 10.0% TE.

### Alex — My Arrakis My ODUNZE

- Round 1: 76.9% RB, 23.1% WR.
- Rounds 1–4 are **balanced RB/WR**: 42.3% RB vs 44.2% WR.
- Typical first QB: Round 9; QB selected by Round 5 in 23.1% of drafts.
- Typical first TE: Round 8; TE selected by Round 5 in 38.5% of drafts.
- Run-response signal: **Neutral (+3.3 pp)** across 144 qualifying run situations.
- Same-position repeat rate from Rounds 2–8: 23.1%.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 13 drafts).
- Career average roster: 4.6 RB, 6.0 WR, 1.6 QB, 1.8 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 50.0% WR, 5.0% QB, 5.0% TE.

## Identity and validation notes

- `--hidden--` appears only in 2013 and is an inactive former member.
- Juan's profile starts in 2014 and contains 12 full drafts.
- The other nine current managers each contain 13 full drafts from 2013–2025.
- Every season contains exactly 160 picks and each 2025 manager has exactly 16 selections.
- Team names are not stable identifiers. `Manager` is the persistent identity key.

## Recommended simulator feature order

1. Manager-specific round/position priors.
2. Roster-state adjustment (starter/flex/depth needs).
3. First-QB and first-TE timing hazard.
4. Recency weighting and confidence shrinkage toward league averages.
5. Draft-slot interaction and same-position repeat tendency.
6. Position-run response as a small contextual modifier.
7. Join historical ADP/ECR by season and learn player-level reach/value tolerance.
8. Monte Carlo simulation from the live draft state, producing player availability probabilities for each future user pick.
