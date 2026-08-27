# Draft Companion interactive simulator

The Draft Companion can run as either a manual live-draft tracker or an interactive mock-draft simulator.

## Start a simulation

1. Import the current rankings file.
2. Configure league size, draft slot, scoring, roster, and strategy.
3. Set **Mode** to **Draft Simulator**.
4. Choose a room profile and pace.
5. Start the draft.

The simulator makes only opponent selections. It always stops when the configured user slot is on the clock so the normal Top 3 recommendation cards, survival probabilities, roster state, and player pool can be inspected before making a user selection.

After the user drafts a player, opponent simulation resumes automatically and stops again at the next user pick.

## Room profiles

- **Normal / rank order** — opponents select the highest-ranked available player.
- **Early RB rush** — opponents prioritize RB through Round 4.
- **Early WR rush** — opponents prioritize WR through Round 4.
- **Early QB rush** — opponents prioritize QB through Round 3.
- **Early TE rush** — opponents prioritize TE through Round 4.
- **Early DST room** — opponents prioritize DST in Rounds 8–10.

These profiles are deterministic QA/practice scenarios rather than probabilistic models of a real room.

## Pace

- **Instant to my pick** — fills every opponent selection until the user's next turn immediately.
- **Watch picks** — advances opponent selections one at a time so the board can be watched as it develops.

Both modes stop before any user selection.

## Opponent setup toggles

**Team names** and **Historical manager data** are independent.

- Team names affect display labels only.
- Historical manager data enables the bounded Purple League V1 historical tendency signal.
- If Team names is disabled while Historical manager data is enabled, selected manager display names are used as the board/team labels.
- Turning either option off does not erase its saved values.

## Persistence and corrections

Simulator mode, room profile, pace, team-name preference, historical-manager preference, picks, and saved assignments are stored with the normal Draft Companion snapshot/JSON backup.

Corrections pause automatic simulator progression until the draft state is contiguous again.
