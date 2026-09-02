# RosterPilot

RosterPilot is a fantasy-football companion focused on draft decision support and, longer term, roster-management automation.

## Draft Companion

The current vertical slice lives in `apps/draft-companion` and supports:

- CSV/XLS/XLSX ranking import
- configurable snake-draft setup
- manual live pick entry and correction
- persistent draft state with JSON backup/restore
- pre-turn Upcoming Targets
- on-clock Top 3 recommendations
- favorites / My Guys
- strategy-aware scoring
- position-run and opponent-demand signals
- Purple League opponent-history modeling for Future Availability
- deterministic simulation and release-readiness tests

The opponent-history model uses corrected 2013–2025 Purple League manager profiles. It is intentionally bounded: manager history can refine whether a player is likely to survive to the user's next turn, but it does not modify imported player rankings or directly override player value.

See:

- `docs/DRAFT_COMPANION_IMPLEMENTATION_PLAN.md`
- `docs/RECOMMENDATION_ENGINE_V2.md`
- `docs/OPPONENT_MODEL_V1.md`
- `docs/DRAFT_NIGHT_QA.md`
- `docs/DRAFT_NIGHT_RUNBOOK.md`

## Draft Companion development

```bash
npm install --no-audit --no-fund
npm run typecheck:draft
npm run test:draft
npm run build:draft
npm run dev:draft
```

The Draft Companion is developed on a dedicated feature branch before integration into the broader RosterPilot product.
