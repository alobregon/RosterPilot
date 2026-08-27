# 2026 Offseason Context Journal

RosterPilot's offseason context journal is a small, curated grounding layer for the future AI coach. It exists to capture **what changed since last season** without asking an LLM to rediscover every relevant fact on draft night.

The machine-readable journal lives at:

```text
apps/draft-companion/data/offseason-context-2026.json
```

The TypeScript access layer lives at:

```text
apps/draft-companion/lib/offseason-context.ts
```

## What belongs in the journal

Good entries are fantasy-relevant changes that can materially alter how historical statistics should be interpreted:

- coaching or coordinator changes
- quarterback changes
- trades, free-agent arrivals and departures
- changes in target or backfield competition
- injuries and recovery timelines
- suspensions or unresolved availability risks
- training-camp/preseason role evidence
- meaningful ADP moves
- clearly attributed analyst breakout, sleeper or fade cases

The journal is curated rather than exhaustive. A fact should be included because it could change a draft decision, not simply because it appeared in an article.

## Fact vs. interpretation

Every entry keeps source-grounded facts separate from the fantasy conclusion.

Example:

```text
Player: Ladd McConkey

Facts:
- Mike McDaniel is the Chargers' new offensive coordinator.
- Keenan Allen is no longer in the Chargers receiving room.

RosterPilot inference:
- Positive environment, medium confidence.
- McConkey has a plausible path to increased opportunity, but the size
  of any production increase is unknown.
```

The inference is explicitly labeled `ROSTERPILOT_INFERENCE`; it must never be presented as a reported fact.

Source-authored opinions are labeled separately, for example `SOURCE_ANALYST`, `SOURCE_CONSENSUS`, or `SOURCE_CONFLICT`.

## Conflicting viewpoints

Conflicts are useful information and should remain in the journal.

For example, one source may see a running back's expanding camp role as a value signal while another considers the same player overpriced because of injury history or competition. RosterPilot should preserve both pieces of evidence and let the eventual AI coach explain the tradeoff.

Do not silently average conflicting claims into a false consensus.

## Time-sensitive entries

Injuries, camp roles, ADP movement, depth-chart battles, legal/suspension risk and recovery timelines should use:

```json
"timeSensitive": true
```

A future ingestion/refresh workflow can use that flag to prioritize which entries need re-verification before a draft.

## Adding a source manually

When the user supplies a useful article:

1. Add a source record with publisher, title, URL and ingestion status.
2. Summarize only fantasy-relevant facts; do not copy article text.
3. Create one or more focused context entries linked by `sourceIds`.
4. If the source itself makes a fantasy recommendation, store it as a source outlook.
5. Add a RosterPilot inference only when the reasoning is explicit and useful.
6. Mark volatile facts as time-sensitive.
7. Keep contradictory entries or facts rather than deleting whichever view is less convenient.
8. Run the Draft Companion test suite.

If the article cannot be read reliably, add the source as `PENDING_EXCERPT` and store **zero claims** from it until readable text is available. This is the current treatment of the supplied ESPN source.

## Use by the future AI coach

The journal does **not** currently change deterministic recommendation scores.

At an on-clock decision, a future context builder can retrieve only the entries associated with the few serious candidates:

```ts
getOffseasonContextForPlayers(
  ['Ladd McConkey', 'Player B', 'Player C'],
  12,
);
```

That compact result can be combined with:

```text
current rankings / ADP / tiers
+ RosterPilot recommendation components
+ chance-back probability
+ current roster and positional runs
+ nflverse historical actuals
+ curated offseason journal
+ future projection/current-news layer
    -> AI coach
```

The AI should always distinguish:

- historical actuals
- current reported facts
- analyst opinions
- RosterPilot inferences
- future projections

## Initial source set

The initial journal was seeded from user-supplied 2026 material from Footballguys, CBS Sports, FantasyPros, NFL.com, Seattle Seahawks and Yahoo Sports. The supplied ESPN article is retained as `PENDING_EXCERPT` because its body was not available to the retrieval client.

Source URLs and ingestion status are stored directly in the JSON journal so every factual entry can be traced back to its source.
