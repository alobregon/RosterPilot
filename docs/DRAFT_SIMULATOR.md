# Draft Companion interactive simulator

The Draft Companion can run as either a manual live-draft tracker or an interactive mock-draft simulator.

## Start a simulation

1. Import the current rankings file.
2. Configure league size, draft slot, scoring, roster, and strategy.
3. Set **Mode** to **Draft Simulator**.
4. Choose a room profile and pace.
5. Optionally enable **Historical manager data** and assign managers to slots.
6. Start the draft.

The simulator makes only opponent selections. It always stops when the configured user slot is on the clock so the normal Top 3 recommendation cards, survival probabilities, roster state, and player pool can be inspected before making a user selection.

After the user drafts a player, opponent simulation resumes automatically and stops again at the next user pick.

Each new simulation receives a fresh run seed. The seed is held constant for that mock, so refreshing or restoring the same saved mock does not reshuffle future close decisions. Restarting and starting a new mock generates a new seed, allowing equally plausible close calls to vary between simulations.

## How opponent picks are chosen

With **Historical manager data off**, the simulator preserves the simple room-profile behavior:

- **Normal / rank order** — opponents select the highest current market-ranked available player.
- **Early RB rush** — opponents prioritize RB through Round 4.
- **Early WR rush** — opponents prioritize WR through Round 4.
- **Early QB rush** — opponents prioritize QB through Round 3.
- **Early TE rush** — opponents prioritize TE through Round 4.
- **Early DST room** — opponents prioritize DST in Rounds 8–10.

With **Historical manager data on**, an assigned manager uses a bounded personalized selection score. Current-year rankings and ADP remain the dominant market signal, then close choices can be adjusted by:

- the manager's current roster need;
- the manager's **sequence-conditioned** Purple League position tendency;
- the manager's historical roster-construction shape;
- the selected room-profile pressure, if any;
- a small run-seeded variation of at most ±1.5 score points so close choices can differ between mocks.

Historical behavior is intentionally restricted to the **top 12 currently available market candidates**. That guardrail prevents old tendencies from manufacturing extreme reaches far outside the current board. Historical player-level reach/wait behavior remains disabled because its walk-forward validation did not beat the neutral baseline.

## Round 1 behavior

Round 1 uses a dedicated recency-weighted first-pick position distribution for each manager rather than the broader Rounds 1-4 profile.

Because there is no roster sequence yet, Round-1 history is intentionally weaker than later conditional history. The manager-specific Round-1 position adjustment is capped at **±3 score points before the normal history weight**. This makes first-pick history a close-call nudge instead of allowing a manager's career RB/WR preference to routinely jump several current-market slots.

For example, Dixie has a genuine strong Round-1 RB history, but that preference should not automatically move an RB ranked several market slots behind an elite WR to the top. A new simulation seed can still make a borderline RB-vs-WR decision vary when the total scores are genuinely close.

## Sequence-aware manager history

The simulator no longer treats a manager's phase-level position tendency as independent of the players they have already drafted.

For assigned managers, the historical position distribution is refined from broad to specific:

1. dedicated Round-1 tendency for the first selection; otherwise R1-4 / R5-8 / R9-12 / R13-16 phase tendency;
2. same-position repeat behavior in Rounds 2-8;
3. whether that manager historically extends a two-pick same-position streak in Rounds 3-8;
4. exact first-four prefix behavior when that exact early sequence has historical observations.

Each more-specific layer is shrunk toward the broader layer beneath it. This prevents a one-season pattern from overpowering the current-year market while also preventing broad tendencies from being double-counted after the manager has already committed to a position.

Example: Sunny-D generally has a strong early-RB tendency. But in the corrected 2013-2025 history, after an `RB-RB` start his third pick was WR three times, RB once, and QB once. After recency weighting and hierarchical shrinkage, the simulator's effective Round 3 distribution is approximately **54.6% WR, 26.8% RB, 17.5% QB, 1.1% TE**. RB-RB-RB remains possible, because it has happened, but it should no longer be the default consequence of the broad early-RB tendency.

See `docs/SIMULATOR_MANAGER_SEQUENCE_MODEL.md` for the derivation and guardrails.

## Important distinction from chance-back probability

The simulator may use assigned manager history to choose simulated opponent picks. The displayed calibrated **chance back by #N** probability does **not** include manager identity. That probability remains based on the validated ADP + return distance + opponent roster-need model. V1 history can still make its separate small bounded recommendation adjustment afterward.

## Pace

- **Instant to my pick** — fills every opponent selection until the user's next turn immediately.
- **Watch picks** — advances opponent selections one at a time so the board can be watched as it develops.

Both modes stop before any user selection.

## Opponent setup toggles

**Team names** and **Historical manager data** are independent.

- Team names affect display labels only.
- Historical manager data enables the bounded Purple League V1 historical tendency signal in recommendations and sequence-aware personalized simulator opponent picks.
- If Team names is disabled while Historical manager data is enabled, selected manager display names are used as the board/team labels.
- Turning either option off does not erase its saved values.

## Persistence and corrections

Simulator mode, room profile, pace, the per-mock simulation seed, team-name preference, historical-manager preference, picks, and saved assignments are stored with the normal Draft Companion snapshot/JSON backup.

Corrections pause automatic simulator progression until the draft state is contiguous again.