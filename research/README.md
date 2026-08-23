# Draft Research

This directory contains the historical data and derived manager-behavior research used to build RosterPilot's league-specific draft simulator.

## Files

### Historical behavior data

The simulator training history is stored as readable CSV shards with the fields:

`Year, Pick, Manager, Position`

- `history/league_pick_positions_2013_2015.csv`
- `history/league_pick_positions_2016_2018.csv`
- `history/league_pick_positions_2019_2021.csv`
- `history/league_pick_positions_2022_2024.csv`

For a 10-team snake draft, round and draft slot are deterministic from overall `Pick`, so they do not need to be duplicated in the training shards.

### 2025 player-level draft

- `history/league_draft_history_2025.csv` — full 2025 normalized draft with `Year, Pick, Manager, Player, Position` for all 160 selections.

### Derived research

- `league_manager_profiles_2013_2025.json.gz` — machine-readable manager priors with recency weighting.
- `league_manager_scouting_2013_2025.md` — human-readable scouting report and simulator recommendations.

The original 2013–2025 player-level source was used to generate these artifacts. The current simulator model consumes manager/pick/position history; a future historical-ADP/ECR research pass should add player-level historical source data together with the matching season market data.

## Identity rules

- `Manager` is the persistent identity key; team names may change every season.
- `--hidden--` is a former member from 2013 only and is inactive.
- Juan joined in 2014 and must not inherit `--hidden--` history.

## Modeling notes

- Current profiles use a recency weight of `0.85^(2025 - season)`.
- Position-run response is treated as a soft signal, not a deterministic rule.
- Historical ADP/ECR has not yet been joined, so the current data supports position/round/roster-timing models but not reliable player-level reach/value estimates.
