# Draft Research

This directory contains historical draft data and derived manager-behavior research for RosterPilot's league-specific draft simulator.

## Files

- `history/league_pick_positions_2013_2015.csv`
- `history/league_pick_positions_2016_2018.csv`
- `history/league_pick_positions_2019_2021.csv`
- `history/league_pick_positions_2022_2024.csv`
- `history/league_draft_history_2025.csv` — corrected 2025 team/manager/player history.
- `league_manager_profiles_2013_2025.json` — machine-readable manager position/timing priors regenerated from the corrected 2013–2025 history.
- `league_manager_adp_profiles_2018_2025.json` — compact recency-weighted, league-relative manager reach/wait behavior derived from historical FantasyPros Overall ADP joins.
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

## Historical ADP modeling

FantasyPros Overall ADP for 2018–2025 has been joined to the corrected player-level league history for QB/RB/WR/TE behavior. The compact derived profile intentionally does not commit the raw FantasyPros exports.

The join covers 1,100 of 1,115 skill-position picks (98.65%). Unmatched rows are excluded rather than force-matched.

For each matched pick:

```text
adp_delta = actual_overall_pick - FantasyPros_AVG_ADP
```

Negative values mean the player was selected ahead of market ADP. Manager behavior is then made league-relative within the same season, draft phase, and position, recency weighted, and shrunk toward neutral for small samples.

See `docs/OPPONENT_MODEL_V2.md` for the live-model contract and safety rails.

## Modeling caution

Historical ADP is a behavior signal, not a replacement ranking source. Current-year imported rankings remain authoritative for player value. Historical reach/wait behavior is used only to refine Future Availability and remains bounded by the same total historical adjustment cap used by V1.
