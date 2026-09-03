# Draft Companion Release Readiness

## Completed deterministic gates

- Full editable league setup and Start Draft locking
- Historical pick edit/remove with correction-gap recovery
- Browser-local persistence plus portable JSON backup/restore
- Hardened backup validation for duplicates, invalid metadata, contradictory state, and out-of-range picks
- Ranking-pool preflight before Start Draft, including league-wide positional depth
- Recommendation Engine V2 with one independent Recommendation strength
- Favorites/My Guys with bounded, price-sensitive influence
- Default-aware draft-slot strategy changes that preserve explicit non-default strategy choices
- Opponent roster saturation and Future Availability market signals
- Formal QUIET / DEVELOPING / HOT position trend engine
- FantasyPros ECR-vs-ADP fallback when explicit ADP is absent
- Reusable rank-order and weird-room full-draft simulation harness
- Mid-draft save/restore, correction-gap recovery, and full 160-pick lifecycle checks
- Real 861-player FantasyPros export passes 10-team league-wide preflight
- Route-level crash recovery UI
- Draft selection no longer forces a vertical page jump back to the draft board
- Pinned Next/React runtime versions
- GitHub Actions verification workflow with a manual trigger

## Required release gates

Before calling the build production-ready, run in a dependency-enabled environment:

```bash
npm install --no-audit --no-fund
npm run typecheck:draft
npm run test:draft
npm run build:draft
```

Then execute `docs/DRAFT_NIGHT_QA.md` on desktop and mobile/tablet widths.

The raw user rankings export, downloaded draft backups, and local validation output must not be committed to the repository.
