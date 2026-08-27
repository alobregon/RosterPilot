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
- the manager's recency-weighted Purple League positional tendency for the current draft phase;
- the selected room-profile pressure, if any;
- a small deterministic jitter so equally plausible choices do not all collapse to the same position.

Historical behavior is intentionally restricted to the **top 12 currently available market candidates**. That guardrail prevents old tendencies from manufacturing extreme reaches far outside the current board. Historical player-level reach/wait behavior remains disabled because its walk-forward validation did not beat the neutral baseline.

The historical tendency used here is the same phase-relative V1 positional behavior already derived from 2013–2025 Purple League drafts. It is a simulator behavior input, not a rewrite of the imported player rankings.

## Important distinction from chance-back probability

The simulator may use assigned manager history to choose simulated opponent picks. The displayed calibrated **chance back by #N** probability does **not** include manager identity. That probability remains based on the validated ADP + return distance + opponent roster-need model. V1 history can still make its separate small bounded recommendation adjustment afterward.

## Pace

- **Instant to my pick** — fills every opponent selection until the user's next turn immediately.
- **Watch picks** — advances opponent selections one at a time so the board can be watched as it develops.

Both modes stop before any user selection.

## Opponent setup toggles

**Team names** and **Historical manager data** are independent.

- Team names affect display labels only.
- Historical manager data enables the bounded Purple League V1 historical tendency signal in recommendations and personalized simulator opponent picks.
- If Team names is disabled while Historical manager data is enabled, selected manager display names are used as the board/team labels.
- Turning either option off does not erase its saved values.

## Persistence and corrections

Simulator mode, room profile, pace, team-name preference, historical-manager preference, picks, and saved assignments are stored with the normal Draft Companion snapshot/JSON backup.

Corrections pause automatic simulator progression until the draft state is contiguous again.
