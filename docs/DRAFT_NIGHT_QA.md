# Draft Companion draft-night QA checklist

## Release gate
- [ ] CI installs dependencies on Node 22.
- [ ] `npm run typecheck:draft` passes.
- [ ] `npm run test:draft` passes.
- [ ] `npm run build:draft` passes.

## Setup and import
- [ ] Import the 861-player FantasyPros rankings file.
- [ ] Confirm the 10-team Half-PPR league passes league-wide positional preflight.
- [ ] Change team count, scoring, roster slots, draft slot, and team names before Start Draft.
- [ ] Confirm **Team names** and **Historical manager data** are independent optional toggles.
- [ ] With both toggles off, confirm the board uses generic Team N labels and historical-manager modeling is inactive.
- [ ] With Team names on and Historical manager data off, confirm custom labels display but no historical behavior is applied.
- [ ] With Team names off and Historical manager data on, confirm selected manager names become the board/team labels.
- [ ] Toggle either preference off/on and confirm previously entered labels or manager assignments are preserved.
- [ ] Refresh / restore a backup and confirm both independent preferences and saved values are preserved.
- [ ] Confirm an explicitly selected non-default strategy survives team-count and slot edits.
- [ ] Start Draft locks structural league settings and ranking import.

## Interactive simulator
- [ ] Select **Draft Simulator** mode before starting.
- [ ] With Historical manager data off, confirm **Normal / rank order** follows the current market board and never auto-selects the user's pick.
- [ ] Enable Historical manager data, assign managers, restart the simulation, and confirm close opponent choices can differ from pure rank order while remaining within the top current market candidates.
- [ ] Confirm personalized opponent picks respond to roster need (for example, a manager who already filled TE is less likely to keep taking TE solely because of historical tendency).
- [ ] Confirm Round 1 uses the dedicated recency-weighted first-pick tendency instead of the broader Rounds 1-4 phase distribution.
- [ ] Confirm the Round-1 historical adjustment is only a close-call nudge: a strong manager preference should not routinely jump several current-market slots.
- [ ] Dixie Round-1 regression with the 2026 board: when Gibbs, Bijan, and Jonathan Taylor are already gone, confirm Ja'Marr Chase normally remains ahead of Christian McCaffrey rather than Dixie's RB history automatically forcing CMC upward.
- [ ] Sunny-D Round-1 regression with the 2026 rankings: after Gibbs, Bijan, Ja'Marr Chase, and Jonathan Taylor are drafted at picks 1-4, confirm Sunny-D at #5 normally takes **Puka Nacua** rather than Christian McCaffrey in Normal room mode.
- [ ] Confirm manager history is **sequence-aware** rather than a repeated phase bonus: after a manager takes the same position twice, the third-pick tendency should reflect that manager's actual repeat/streak history.
- [ ] Sunny-D regression: after an `RB-RB` start in Round 3, confirm close WR/RB choices favor WR rather than blindly extending the broad early-RB tendency. RB-RB-RB should remain possible only when current market value is strong enough to overcome the conditional history.
- [ ] Confirm manager-specific historical roster construction nudges depth picks toward each manager's typical final roster shape without overriding starter/FLEX needs.
- [ ] Run the same simulator setup multiple times using Restart Draft + Start Draft and confirm some genuinely close opponent decisions can vary between mocks.
- [ ] During one mock, refresh or restore its backup and confirm the saved simulation seed keeps subsequent close decisions stable from the same draft state.
- [ ] Confirm disabling Historical manager data returns Normal mode to pure market-order opponent picks.
- [ ] Confirm **Instant to my pick** fills opponent selections immediately and stops on the user's turn.
- [ ] Confirm **Watch picks** advances one opponent at a time and stops on the user's turn.
- [ ] Make the user's selection from the Top 3 and confirm simulation resumes automatically afterward.
- [ ] Exercise RB Rush, WR Rush, QB Rush, TE Rush, and Early DST room profiles and confirm the intended position pressure is visible.
- [ ] Confirm simulator mode, room profile, pace, per-mock seed, and historical-manager assignments survive refresh / JSON backup restore.
- [ ] Confirm corrections pause simulator advancement and resume after the correction is repaired.

## Live draft
- [ ] Enter picks rapidly without the page jumping vertically back to the board after each selection.
- [ ] The current pick and on-clock team remain visually clear.
- [ ] Top-3 Recommendation % values sum to exactly 100%.
- [ ] Favorites, market-fall, positional-run, starter-need, and strategy signals remain readable.
- [ ] Favorites and Drafted filters behave correctly.

## Corrections and recovery
- [ ] Undo removes only the latest entered pick.
- [ ] Editing a historical pick replaces only that pick.
- [ ] Removing a historical pick creates a correction gap and pauses recommendations.
- [ ] Refresh with a correction gap resumes at the earliest missing pick.
- [ ] Repairing the gap resumes the previously live pick.
- [ ] Download a JSON backup mid-draft and restore it successfully.
- [ ] Invalid backups with duplicate players/picks are rejected.
- [ ] Invalid backups with an out-of-range pick (for example #161 in a 160-pick draft) are rejected.
- [ ] Invalid optional metadata such as a string ADP is rejected.

## Full draft and viewports
- [ ] Enter all 160 picks without duplicate player selections.
- [ ] Required roster positions remain legal at completion.
- [ ] Draft completion persists and restores as complete.
- [ ] Desktop 1440px, laptop 1024px, and mobile 390px layouts remain usable.