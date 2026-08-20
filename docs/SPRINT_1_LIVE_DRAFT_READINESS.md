# Sprint 1 — Live Draft Readiness

## Goal

Make Draft Companion safe and efficient enough to operate during a real live draft before adding more recommendation-model complexity.

## Task 1 — Complete League Setup

Implemented locally:

- explicit Setup → Start Draft → Live Draft state;
- editable team count (4–20) and user draft slot;
- Standard, Half-PPR, and PPR scoring selection;
- editable QB/RB/WR/TE/FLEX/DST/K starter counts and bench size;
- optional team names for every draft slot;
- structural settings lock after Start Draft;
- draft strategy remains editable after lock;
- ranking import locks after Start Draft;
- Restart / edit setup clears entered picks and unlocks structural settings;
- setup state, team names, strategy, favorites, player pool, and picks persist locally;
- older saved snapshots restore with blank team names and infer whether a draft had started.

The current 10-team Half-PPR configuration remains the default preset.

## Task 2 — Draft Correction Tools

Implemented locally:

- Edit any filled board cell without shifting later picks;
- Remove any filled historical pick and force the missing selection to be refilled;
- current-pick discovery uses the first open overall-pick number instead of `picks.length + 1`;
- recommendations pause while a historical correction is active;
- correction UI identifies the original player and target overall pick;
- cancellation restores a removed pick during the current session;
- a historical gap recovered after refresh is detected automatically and must be filled before live recommendations resume;
- Undo is disabled while a correction gap is active to avoid compounding state errors.

## Task 3 — Live Draft Board UX

Implemented locally:

- active pick automatically scrolls into view;
- correction targets also scroll into view;
- the round-number column remains sticky during horizontal scrolling;
- the team currently involved in the active/correction pick is highlighted;
- custom team names are used consistently in status, board headers, history, and drafted-player status.

## Task 4 — Player Pool UX

Implemented locally:

- existing All, Favorites, and position filters retained;
- Drafted filter added so a selected player never simply disappears from search;
- Rank, ADP, and Name sorting added;
- drafted players show their overall pick and team;
- search remains available across both available and drafted views;
- Favorites remain editable before and during a live draft.

## Validation

Completed locally:

- strict TypeScript compile for setup, persistence, board, correction, strategy, and recommendation libraries;
- compile coverage for setup, persistence, correction, recommendation, strategy, availability, and roster-logic tests;
- runtime checks for team-name persistence, setup validation, fixed historical-pick replacement, and historical-gap detection;
- TSX syntax/transpile check for the integrated page;
- existing Recommendation Engine V2 smoke harness still passes.

A full Next.js build and real Vitest execution still require the project dependency environment.

## Follow-on Sprint 2 / Validation work completed in the same local slice

- plain-language recommendation signal chips without adding a second percentage;
- opponent positional-demand saturation;
- ADP-aware Future Availability when ADP exists;
- reusable full-draft deterministic simulation harness;
- real 861-player simulation across draft slots 1–10 with current Favorite settings.

A clean workspace was assembled for a full dependency-backed test/build. `npm install` timed out repeatedly before `node_modules` was created, so full Vitest and Next production build execution remain outstanding environment-dependent checks rather than known failures.
