# 2026 Offseason Context Journal

RosterPilot's offseason context journal is a small, curated grounding layer for the draft decision engine and future AI coach. It exists to capture **what changed since last season** without asking an LLM to rediscover every relevant fact on draft night.

The machine-readable journal is split into a base file plus source-specific supplements:

```text
apps/draft-companion/data/offseason-context-2026.json
apps/draft-companion/data/offseason-context-2026-espn.json
apps/draft-companion/data/offseason-context-2026-yahoo-phillyvoice.json
apps/draft-companion/data/offseason-context-2026-si.json
apps/draft-companion/data/offseason-context-2026-injuries-sept.json
apps/draft-companion/data/offseason-context-2026-injuries-sept-overrides.json
```

The TypeScript access layer merges those files by source and entry ID:

```text
apps/draft-companion/lib/offseason-context.ts
```

The on-clock scoring adapter lives separately:

```text
apps/draft-companion/lib/context-signal.ts
```

A supplemental source or entry with an existing ID replaces the base record. This lets us correct metadata, separate beneficiary context from an injured player's own outlook, or upgrade a source from `PENDING_EXCERPT` to `INGESTED` without rewriting the large base journal.

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
- offensive-line changes that materially affect a fantasy environment
- schedule/context notes when a source argues they materially affect a close draft decision
- clearly attributed analyst breakout, sleeper or fade cases

The journal is curated rather than exhaustive. A fact should be included because it could change a draft decision, not simply because it appeared in an article. Defensive-only offseason moves are generally omitted unless they materially affect a standard fantasy decision.

## Fact vs. interpretation

Every entry keeps source-grounded facts separate from the fantasy conclusion.

Example:

```text
Player: Ladd McConkey

Facts:
- Mike McDaniel is the Chargers' new offensive coordinator.
- Keenan Allen is no longer in the Chargers receiving room.
- Alec Ingold followed McDaniel to Los Angeles.
- ESPN reports McDaniel's 2025 Miami offense used 21 personnel heavily.

RosterPilot inference:
- Positive/mixed-positive environment, medium confidence.
- The personnel and scheme changes create plausible opportunity and matchup
  changes, but they do not prove that McConkey's target volume will increase.
```

The inference is explicitly labeled `ROSTERPILOT_INFERENCE`; it must never be presented as a reported fact.

Source-authored opinions are labeled separately, for example `SOURCE_ANALYST`, `SOURCE_CONSENSUS`, or `SOURCE_CONFLICT`. Source projections remain projections. For example, ESPN's expectation that DJ Moore will exceed 100 targets in Buffalo is stored as a `SOURCE_ANALYST` outlook, not as a factual 2026 stat.

Schedule-strength claims are also analyst context rather than hard player projections. They should normally receive lower confidence because defensive quality and matchup difficulty can change materially once the season begins.

## Conflicting viewpoints

Conflicts are useful information and should remain in the journal.

For example, one source may see a running back's expanding camp role as a value signal while another considers the same player overpriced because of injury history or competition. RosterPilot should preserve both pieces of evidence and let the decision layer or eventual AI coach explain the tradeoff.

Do not silently average conflicting claims into a false consensus.

## Time-sensitive entries

Injuries, camp roles, ADP movement, depth-chart battles, legal/suspension risk, recovery timelines and schedule-strength assessments should use:

```json
"timeSensitive": true
```

A future ingestion/refresh workflow can use that flag to prioritize which entries need re-verification before a draft.

## Adding a source manually

When the user supplies a useful article:

1. Add or update a source record with publisher, title, URL and ingestion status.
2. Summarize only fantasy-relevant facts; do not copy article text.
3. Create one or more focused context entries linked by `sourceIds`.
4. If the source itself makes a fantasy recommendation or projection, store it as a source outlook.
5. Add a RosterPilot inference only when the reasoning is explicit and useful.
6. Mark volatile facts as time-sensitive.
7. Keep contradictory entries or facts rather than deleting whichever view is less convenient.
8. Keep an injured player's outlook separate from a beneficiary's outlook when they move in opposite directions.
9. Run the Draft Companion test suite.

If an article cannot be read reliably, add the source as `PENDING_EXCERPT` and store **zero claims** from it until readable text is available. Once readable text is supplied, a supplement may replace that source record with `INGESTED` and add grounded entries.

## ESPN supplement

The user-provided ESPN newcomers article is now ingested. The supplement intentionally keeps only offensive/fantasy-relevant context, including examples such as:

- A.J. Brown joining Drake Maye in New England
- Kyler Murray moving into Kevin O'Connell's Minnesota offense
- Jaylen Waddle joining Bo Nix and Courtland Sutton in Denver
- DJ Moore becoming Buffalo's projected top receiver
- Jeremiyah Love's three-down upside in Arizona
- Mike Evans' projected boundary/red-zone role in San Francisco
- Kenneth Walker III joining Kansas City
- Houston offensive-line investment around C.J. Stroud and David Montgomery
- Isaiah Likely's larger opportunity with the Giants
- Alec Ingold following Mike McDaniel to the Chargers
- Makai Lemon's opportunity after A.J. Brown's departure from Philadelphia
- Travis Etienne joining a Saints backfield that still includes Alvin Kamara
- the expected Kirk Cousins-to-Fernando Mendoza quarterback transition in Las Vegas

The supplement also corrects the initial Sam Darnold team tag to Seattle while retaining the legacy entry ID so saved references remain stable.

## Yahoo + PhillyVoice supplement

The Yahoo/Lindy's Amon-Ra St. Brown article contributes a small schedule-strength context note. It is intentionally `LOW_MEDIUM` confidence and should be used only as a tie-breaker, not as a reason to override a meaningful ranking/value gap.

The PhillyVoice running-back article contributes higher-signal current-role and risk context for several 2026 backs, including:

- Jahmyr Gibbs after David Montgomery's move to Houston
- Christian McCaffrey's elite 2025 production alongside age/efficiency/regression concerns
- Saquon Barkley's extreme recent workload plus Philadelphia's scheme/line context
- Kenneth Walker III's projected Kansas City workload
- Omarion Hampton's fit in Mike McDaniel's run-oriented Chargers offense
- Ashton Jeanty's Klint Kubiak fit plus current ankle issue
- Travis Etienne's move to New Orleans
- De'Von Achane's post-McDaniel volume uncertainty
- Bucky Irving's added competition from Kenneth Gainwell and Sean Tucker
- Josh Jacobs' efficiency and then-current possible-suspension risk

Rankings, breakout claims, fades and future workload expectations from the article remain `SOURCE_ANALYST` outlooks rather than factual projections.

## Sports Illustrated WR sleepers supplement

The Sports Illustrated Aug. 6 WR-sleepers article adds four mid-round receiver cases:

- Alec Pierce: reduced target competition after Michael Pittman Jr.'s departure, paired with a current ankle/PUP concern
- Jakobi Meyers: sustained Jacksonville target volume after his 2025 trade and a source-authored sleeper case against his market price
- Jayden Reed: fewer Green Bay target competitors after Romeo Doubs and Dontayvion Wicks departed, plus a source-authored target-leader/WR2-upside case
- Quentin Johnston: a cheaper Chargers passing-game exposure case relative to Ladd McConkey, with big-play/TD upside balanced against inconsistency

The article's sleeper labels, ceiling calls and advice to reach or wait remain `SOURCE_ANALYST` outlooks. ADP references, injuries and depth-chart context are marked time-sensitive so they can be refreshed before draft night.

## September injury and availability supplements

The late-August/early-September supplement ingests the user-supplied Yahoo/Athlon WR injury update, Athlon RB injury update and CBS Josh Jacobs availability article. These records are intentionally among the most time-sensitive in the journal.

High-impact WR examples include:

- Puka Nacua: psoas soreness and incomplete unrestricted-practice progression, but Week 1 still expected
- Ja'Marr Chase and Tee Higgins: minor/managed injuries with no current source-recommended valuation downgrade
- Malik Nabers: Week 1 uncertainty plus possible early snap-limit risk
- Emeka Egbuka: toe sprain and shrinking preparation window
- Alec Pierce: progress off PUP but possible early snap limitation
- Khalil Shakir: multi-week undisclosed absence without a return timetable at publication
- Jordyn Tyson, Tank Dell and Christian Kirk: injured-reserve absences
- Jayden Higgins, Ricky Pearsall and Chris Brazzell II: season-ending injuries

High-impact RB examples include:

- Jeremiyah Love: high-ankle sprain and meaningful Week 1/workload uncertainty
- Ashton Jeanty: lower-grade ankle sprain with early-round value retained but added near-term risk
- Breece Hall and Rachaad White: expected-return cases that still require practice progression
- Alvin Kamara: MCL sprain with a four-to-six-week timetable and increased committee risk
- Zach Charbonnet: ACL recovery without a firm return timetable
- Isiah Pacheco: new back issue with Week 1 uncertainty
- James Conner: foot-surgery recovery and uncertain opener availability
- Tyler Allgeier: explicit beneficiary context while Arizona's other top backs are limited
- Rhamondre Stevenson and Jonathon Brooks: smaller beneficiary signals tied to injuries ahead of them

### Josh Jacobs / Green Bay update

The CBS Aug. 31 report materially supersedes the older journal's practical availability assumption for Josh Jacobs. CBS reports that Jacobs was placed on the NFL commissioner's exempt list after being charged with battery and criminal damage to property. The journal records the **league status and uncertainty**, not a judgment about the underlying allegations or eventual discipline.

The latest signals are stored separately:

- Josh Jacobs: `NEGATIVE / HIGH` availability context; no reliable near-term return date
- MarShawn Lloyd: `POSITIVE / MEDIUM_HIGH`; source sees RB3 draft value with RB2 upside while Jacobs is unavailable
- Christopher Brooks: smaller PPR-oriented opportunity signal
- Kaleb Johnson: contingent depth after Green Bay acquired him from Pittsburgh
- Jordan Love, Christian Watson, Tucker Kraft, Matthew Golden and Jayden Reed: small positive passing-volume context if Green Bay leans somewhat more pass-heavy without Jacobs

The injury override file also corrects a modeling subtlety: when one article says an injury hurts Player A while benefiting Player B, those are represented as **separate entries** so the scoring adapter cannot accidentally give Player B Player A's negative outlook.

## Use by the on-clock decision engine

The journal contributes a **bounded final tie-breaker** to `recommendForCurrentPick`. It does not modify imported ranks, tiers, ADP, survival probability, or the deterministic base-factor breakdown.

The context adapter:

- converts positive/negative outlook direction, confidence and origin into a small signed contribution;
- caps the combined effect at **+/-3 raw recommendation-score points**;
- gives source consensus slightly more weight than one analyst, and gives explicit RosterPilot inference less weight than a source-authored outlook;
- preserves `SOURCE_CONFLICT` as weak evidence rather than treating it as consensus;
- suppresses context for K/DST;
- emits a source-labeled explanation when context materially affects a displayed candidate.

Most importantly, rank and tier discipline shrink the adjustment as a player moves away from the best-ranked serious candidate. The current rank-gap windows are intentionally tight early and wider later:

```text
Rounds 1-2: full within 1 rank; no context boost beyond 4 ranks
Rounds 3-4: full within 2 ranks; no context boost beyond 6 ranks
Rounds 5-8: full within 3 ranks; no context boost beyond 9 ranks
Rounds 9+:  full within 4 ranks; no context boost beyond 12 ranks
```

A one-tier disadvantage halves the remaining context adjustment. A two-tier-or-greater disadvantage suppresses it entirely.

That guardrail encodes the draft-walkthrough lesson directly: context can help Amon-Ra over a nearly identical early-round alternative, help Ladd/Reed/Lemon in close mid-round decisions, but cannot turn a compelling article into permission to jump a meaningful ECR/tier gap such as a lower-ranked Tier-3 player over the final Tier-2 value.

Regression coverage lives in:

```text
apps/draft-companion/tests/context-signal.test.ts
```

## Use by the future AI coach

The deterministic tie-breaker uses only the compact directional signal. A future AI coach can still retrieve the richer entries associated with the few serious candidates:

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

The journal was seeded from user-supplied 2026 material from Footballguys, CBS Sports, ESPN, FantasyPros, NFL.com, Seattle Seahawks, Yahoo Sports/Lindy's Sports, PhillyVoice, Sports Illustrated, Athlon Sports and Yahoo Sports.

Source URLs and ingestion status are stored directly in the machine-readable journal files so every factual entry can be traced back to its source.
