# Draft Companion — Draft Night Runbook

## Before the draft

1. Open Draft Companion and import the full rankings export.
2. Confirm the preflight check is green. A 10-team, 16-round draft needs at least 160 ranked players.
3. Configure teams, scoring, roster slots, draft slot, and optional team names.
4. Star any My Guys/Favorites you want the engine to consider.
5. Choose the opening strategy. Slots 1–2 default to Hero RB in the current validation preset; strategy remains editable during the draft.
6. Click **Start draft** only after the league structure is correct.
7. Download a JSON backup before the draft begins.

## During the draft

- Enter each selection from the player pool. The board advances to the next open overall pick.
- Recommendation cards show one relative Recommendation % across the Top 3. The percentages sum to 100 and are not outcome probabilities.
- Use explanation chips for starter need, tier cliffs, market falls, Favorites, strategy fit, and position runs.
- Download another backup periodically or after major corrections.

## Correcting an entry

- Use **Edit** to replace a historical pick without shifting later snake assignments.
- Use **Remove** to create an explicit gap. Recommendations pause until that historical gap is filled.
- A refresh preserves the same correction gap and resumes at the earliest open overall pick.

## Recovery

If the page refreshes or closes, reopen Draft Companion. The app restores the latest valid browser snapshot and resumes at the first open pick.

If browser storage is unavailable or the saved state is rejected, use **Restore backup** and select the most recent RosterPilot JSON backup.

Malformed backups, duplicate player IDs, duplicate picks, impossible snake metadata, and backups that contain picks while claiming the draft never started are rejected rather than partially restored.

## End of draft

Confirm the roster is complete and required lineup positions are filled. Keep the final JSON backup with the league's draft records until the season is underway.
