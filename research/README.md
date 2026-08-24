# Draft Research

This directory contains historical draft data and derived manager-behavior research for RosterPilot's league-specific draft simulator.

## Files

- `history/league_pick_positions_2013_2015.csv`
- `history/league_pick_positions_2016_2018.csv`
- `history/league_pick_positions_2019_2021.csv`
- `history/league_pick_positions_2022_2024.csv`
- `history/league_draft_history_2025.csv` — corrected 2025 team/manager/player history.
- `league_manager_profiles_2013_2025.json` — machine-readable manager priors and behavioral features regenerated from the corrected 2013–2025 history.
- `league_manager_scouting_2013_2025.md` — human-readable scouting report and simulator guidance.

## Identity rules

- `Manager` is the persistent identity key; team names may change each season.
- `--hidden--` is a former member from 2013 only and is inactive.
- Juan joined in 2014 and must not inherit `--hidden--` history.
- The 2025 team-to-manager mapping was manually corrected from the league member roster before regenerating all manager profiles.

## 2025 mapping

- Dildo Year → Dixie
- Me Lo Paro- Now it Hurts → Juan
- Emeka Wish Foundation → Alvaro Obregon
- The Kittle Engine that Could → Armando
- Taylor-Made → Sunny-DCommissioner
- Run like Achane-telope → Hansel
- Nthin Beats a JJettas Holiday✈ → Juan Urtecho
- It’s Gonna Be Maye → PJ
- My Arrakis My ODUNZE → Alex
- Hijo de la Gran Puka! → Ryan

## Modeling caution

Historical ADP/ECR has not yet been joined. The current research supports round/position priors, QB/TE timing, roster construction, same-position repeat behavior, positional-run response, and recency weighting. It does **not** yet support reliable player-level reach/value tolerance.
