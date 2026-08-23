# Draft Research

This directory contains the historical data and derived manager behavior research used to build RosterPilot's league-specific draft simulator.

## Files

- `league_draft_history_2013_2025.csv.gz` — gzip-compressed normalized 10-team draft history, 160 picks per season. Decompress to recover the CSV used for analysis.
- `league_manager_profiles_2013_2025.json.gz` — gzip-compressed machine-readable manager priors with recency weighting.
- `league_manager_scouting_2013_2025.md` — human-readable scouting report and simulator recommendations.

## Identity rules

- `Manager` is the persistent identity key; team names may change every season.
- `--hidden--` is a former member from 2013 only and is inactive.
- Juan joined in 2014 and must not inherit `--hidden--` history.

## Modeling caution

Historical ADP/ECR has not yet been joined. Until it is, this dataset supports position/round/roster-timing models but not reliable player-level reach/value estimates.
