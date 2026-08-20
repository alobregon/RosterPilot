# Draft Companion Release Readiness

## Completed deterministic gates

- Full editable league setup and Start Draft locking
- Historical pick edit/remove with correction-gap recovery
- Browser-local persistence plus portable JSON backup/restore
- Ranking-pool preflight before Start Draft
- Recommendation Engine V2 with one normalized Recommendation %
- Favorites/My Guys with bounded, price-sensitive influence
- Strategy precedence for Late QB and Zero RB
- Opponent roster saturation and Future Availability market signals
- Formal QUIET / DEVELOPING / HOT position trend engine
- FantasyPros ECR-vs-ADP fallback when explicit ADP is absent
- Reusable rank-order and weird-room full-draft simulation harness
- Route-level crash recovery UI
- Pinned Next/React runtime versions
- GitHub Actions verification workflow

## Required release gates

The following should be green in a dependency-enabled environment before calling the build production-ready:

```bash
npm install
npm run typecheck:draft
npm run test:draft
npm run build:draft
```

Then manually QA on desktop and mobile/tablet widths:

- ranking import and preflight
- start/lock/restart setup
- 10-team board horizontal navigation
- Favorites and Drafted filters
- edit/remove correction flow
- refresh resume
- JSON download/restore
- Top-3 explanation chips
- final-round required-position behavior

The raw user rankings export must not be committed to the repository.
