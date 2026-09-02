# Manager-specific roster construction

When **Historical manager data** is enabled in Draft Simulator mode, opponent picks use a bounded roster-construction signal derived from each manager's corrected 2013–2025 Purple League history.

This layer complements, rather than replaces, the existing simulator signals:

1. Current ranking / ADP remains the dominant player-market signal.
2. Generic roster need protects configured QB/RB/WR/TE starters, FLEX, DST, and K requirements.
3. Sequence-aware manager history models what a manager tends to do after their prior positions.
4. Manager-specific roster construction nudges close depth decisions toward the roster shape that manager historically finishes with.
5. Room-profile bias and a small deterministic jitter remain secondary scenario controls.

## Historical target

`research/league_manager_profiles_2013_2025.json` contains `average_final_roster` for every current manager. The simulator converts those historical counts into position shares instead of treating them as exact roster counts. This keeps the signal usable if the current league configuration has a different total roster size.

For a candidate position, the model compares the manager's current roster with the number of players at that position implied by the manager's historical roster share after the same number of selections. Being ahead of that historical pace creates a small negative bias; being behind it creates a small positive bias.

A second, smaller term compares the manager's historical position share with the league-average manager share. This preserves differences such as one manager historically carrying more WR depth or more TE depth than the league as a whole.

## Guardrails

The manager-specific construction adjustment is capped at **±4 simulator score points**. It is deliberately smaller than primary starter/FLEX need and cannot move the simulator outside the existing top-12 available market-candidate window.

The construction signal also gains modest influence as the draft progresses. Early-round choices therefore remain dominated by current rankings, roster starters, and sequence history, while later depth choices become more reflective of the manager's historical final roster shape.

This signal is used only for simulated opponent selections. It does **not** enter the calibrated `chance back by #N` probability, which remains based on the validated survival model inputs.
