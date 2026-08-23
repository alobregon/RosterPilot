# Purple League Manager Scouting Report (2013–2025)

This report summarizes draft-position behavior for the 10 current managers using 13 seasons of league draft history (Juan has 12 seasons, 2014–2025). `--hidden--` is treated as a former 2013-only member and is excluded from current-manager profiles.

## How to use this research

- Use **round/position probabilities** as manager-specific priors in the draft simulator.
- Use **QB/TE timing** to estimate when managers become threats for scarce one-starter positions.
- Use **run-response lift** only as a soft modifier; it compares whether a manager followed a position that appeared at least twice in the previous three league picks against that manager's normal position mix for the same draft phase.
- Weight recent seasons more heavily. The machine-readable profile uses `0.85^(2025-season)`.
- Do **not** estimate reach tolerance yet. The history file has player names but no historical ADP/ECR; joining yearly market data is the next required research step for player-level selection models.

## Current managers at a glance

| Manager | 2025 team | Drafts | R1 RB | R1 WR | First QB | First TE | Run response |
|---|---|---:|---:|---:|---:|---:|---|
| Dixie | Dildo Year | 13 | 76.9% | 23.1% | R9 | R6 | Neutral (-4.3 pp) |
| Sunny-DCommissioner | Me Lo Paro- Now it Hurts | 13 | 61.5% | 38.5% | R5 | R7 | Neutral (-1.1 pp) |
| PJ | Emeka Wish Foundation | 13 | 53.8% | 30.8% | R5 | R8 | Neutral (+2.6 pp) |
| Juan Urtecho | The Kittle Engine that Could | 13 | 53.8% | 46.2% | R7 | R6 | Neutral (-5.0 pp) |
| Ryan | Taylor-Made | 13 | 53.8% | 46.2% | R6 | R7 | Neutral (+2.6 pp) |
| Armando | Run like Achane-telope | 13 | 46.2% | 38.5% | R5 | R4 | Fades (-18.6 pp) |
| Hansel | Nthin Beats a JJettas Holiday✈ | 13 | 53.8% | 46.2% | R6 | R8 | Chases (+10.5 pp) |
| Juan | It’s Gonna Be Maye | 12 | 66.7% | 25.0% | R5.5 | R5.5 | Neutral (+0.7 pp) |
| Alvaro Obregon | My Arrakis My ODUNZE | 13 | 61.5% | 38.5% | R7 | R6 | Neutral (-1.4 pp) |
| Alex | Hijo de la Gran Puka! | 13 | 69.2% | 30.8% | R9 | R8 | Neutral (-2.6 pp) |

## Manager profiles

### Dixie — Dildo Year

- Strong Round-1 RB lean (76.9% of drafts).
- Rounds 1–4 lean RB (50.0% RB vs 40.4% WR).
- Typical first QB: Round 9; first TE: Round 6.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-RB-WR-WR** (4 of 13 drafts).
- Career average roster: 5.4 RB, 5.9 WR, 1.2 QB, 1.4 TE.
- Recent 2021–2025 first-four mix: 50.0% RB, 35.0% WR.

### Sunny-DCommissioner — Me Lo Paro- Now it Hurts

- Round 1 leans RB (61.5% RB vs 38.5% WR).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 5; first TE: Round 7.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **WR-WR-RB-RB** (3 of 13 drafts).
- Career average roster: 4.8 RB, 6.2 WR, 1.5 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 50.0% RB, 35.0% WR.

### PJ — Emeka Wish Foundation

- Round 1 leans RB (53.8% RB vs 30.8% WR).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 5; first TE: Round 8.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-WR-RB-WR** (3 of 13 drafts).
- Career average roster: 5.2 RB, 5.8 WR, 1.4 QB, 1.6 TE.
- Recent 2021–2025 first-four mix: 45.0% RB, 50.0% WR.

### Juan Urtecho — The Kittle Engine that Could

- Round 1 is close to RB/WR neutral; WR used 46.2% of the time.
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 7; first TE: Round 6.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-WR-RB-WR** (3 of 13 drafts).
- Career average roster: 4.8 RB, 6.2 WR, 1.2 QB, 1.8 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 45.0% WR.

### Ryan — Taylor-Made

- Round 1 is close to RB/WR neutral; WR used 46.2% of the time.
- Rounds 1–4 lean WR (51.9% WR vs 38.5% RB).
- Typical first QB: Round 6; first TE: Round 7.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-RB-WR-WR** (2 of 13 drafts).
- Career average roster: 5.1 RB, 6.2 WR, 1.3 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 50.0% RB, 50.0% WR.

### Armando — Run like Achane-telope

- Round 1 leans RB (46.2% RB vs 38.5% WR).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 5; first TE: Round 4.
- Strong anti-run signal: 18.6 percentage points below own baseline.
- Most common first-four pattern: **RB-RB-WR-WR** (2 of 13 drafts).
- Career average roster: 4.6 RB, 5.7 WR, 1.6 QB, 1.9 TE.
- Recent 2021–2025 first-four mix: 45.0% RB, 35.0% WR.

### Hansel — Nthin Beats a JJettas Holiday✈

- Round 1 is close to RB/WR neutral; WR used 46.2% of the time.
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 6; first TE: Round 8.
- Meaningful run-chasing signal: +10.5 percentage points above own baseline.
- Most common first-four pattern: **WR-RB-WR-RB** (3 of 13 drafts).
- Career average roster: 4.5 RB, 6.5 WR, 1.6 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 35.0% RB, 50.0% WR.

### Juan — It’s Gonna Be Maye

- Strong Round-1 RB lean (66.7% of drafts).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 5.5; first TE: Round 5.5.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 12 drafts).
- Career average roster: 4.6 RB, 5.7 WR, 1.7 QB, 2.0 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 45.0% WR.

### Alvaro Obregon — My Arrakis My ODUNZE

- Round 1 leans RB (61.5% RB vs 38.5% WR).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 7; first TE: Round 6.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 13 drafts).
- Career average roster: 5.2 RB, 5.8 WR, 1.5 QB, 1.5 TE.
- Recent 2021–2025 first-four mix: 35.0% RB, 45.0% WR.

### Alex — Hijo de la Gran Puka!

- Strong Round-1 RB lean (69.2% of drafts).
- Rounds 1–4 are balanced between RB and WR.
- Typical first QB: Round 9; first TE: Round 8.
- Position-run response is roughly neutral after controlling for own position mix.
- Most common first-four pattern: **RB-WR-RB-WR** (2 of 13 drafts).
- Career average roster: 4.7 RB, 5.9 WR, 1.6 QB, 1.8 TE.
- Recent 2021–2025 first-four mix: 40.0% RB, 45.0% WR.

## Identity and data notes

- `--hidden--` is a former member who appears only in 2013. Their selections should never be used to train Juan.
- Juan's profile starts in 2014 and contains 12 full drafts.
- The other nine current managers each have 13 drafts from 2013–2025.
- Team names are not stable identifiers. The `Manager` column is the persistent identity key for simulation training.

## Recommended simulator feature order

1. Manager-specific round/position priors.
2. Roster-state adjustment (starter/flex/depth needs).
3. First-QB and first-TE timing hazard.
4. Recency weighting and manager-confidence shrinkage toward league averages.
5. Position-run response as a small contextual modifier.
6. Join historical ADP/ECR by season, then learn player-level reach/value tolerance.
7. Monte Carlo simulation from the live draft state, producing player availability probabilities at each of the user's future picks.
