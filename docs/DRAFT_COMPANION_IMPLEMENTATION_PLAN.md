# RosterPilot Draft Companion — Implementation Plan

**Status:** Active feature development  
**Initial delivery:** Standalone web app in `apps/draft-companion`  
**Primary use case:** Live fantasy-football snake drafts  
**Integration strategy:** Build and validate the draft experience independently, then reuse the engine inside the broader RosterPilot product.

---

## 1. Product goal

Draft Companion helps a fantasy manager make live draft decisions using a ranking spreadsheet supplied by the user.

During the draft, the user enters selections as they occur. The application maintains the draft board, available player pool, team rosters, the user's next pick, and recommendation context. When the user is on the clock, it returns three recommended players with a recommendation-strength score and explainable reasons.

The recommendation percentage is a **relative recommendation-strength score**, not a literal probability that the pick will succeed.

## 2. Core product principles

### User rankings remain authoritative

The uploaded spreadsheet is the primary player-value source. RosterPilot may adjust urgency based on draft context, but it should not silently replace the user's rankings with an LLM opinion.

```text
User rankings
    +
Draft state
    +
Roster construction
    +
Tier urgency
    +
Draft strategy
    +
Future availability
    ↓
Recommendation engine
```

### Deterministic engine first, AI second

The scoring engine should remain deterministic and inspectable. An LLM can later explain recommendations, answer draft questions, compare choices, and translate natural-language strategy into structured settings.

The LLM should not be the source of truth for player identity, draft state, roster legality, or recommendation math.

### Optimize for live-draft speed

Entering a pick must take only a few seconds. Search, click-to-draft, automatic snake-order assignment, and undo are core interaction requirements.

### Validate before integrating providers

Yahoo, Sleeper, ESPN, and automatic draft synchronization are intentionally deferred until the manual draft workflow proves useful.

---

## 3. Current standalone architecture

The first vertical slice intentionally uses a single Next.js/TypeScript application with browser state.

```text
apps/draft-companion
├── app/
│   ├── page.tsx            # Live draft UI
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── types.ts            # Domain types
│   ├── draft.ts            # Snake-draft calculations
│   ├── spreadsheet.ts      # Ranking import
│   └── recommendation.ts   # Deterministic scoring
└── tests/
    ├── draft.test.ts
    └── recommendation.test.ts
```

This phase does **not** require a backend database. Browser state lets us validate the interaction model before adding persistence and account infrastructure.

The domain modules under `lib/` should remain free of React dependencies where practical so they can later move to a shared package such as `packages/draft-engine`.

---

## 4. Current vertical slice

The initial implementation supports:

- `.xlsx`, `.xls`, and `.csv` ranking imports
- common header aliases for Player, Position, Rank, Team, Tier, ADP, projected points, and notes
- validation and warnings for invalid or duplicate rows
- configurable team count and user draft slot
- snake-draft order calculation
- automatic assignment of selections to the team on the clock
- player search and position filtering
- manual click-to-draft entry
- undo of the latest pick
- user's roster tracking
- recent-pick history
- top-three recommendations
- recommendation-strength scores
- explanation reasons based on ranking value, roster fit, tier urgency, and value at the user's next selection

Run locally from the repository root:

```bash
npm install
npm run dev:draft
```

---

## 5. Spreadsheet contract

### Required fields

The importer needs columns representing:

- Player
- Position
- Rank

Common aliases are accepted, including `Name`, `POS`, `RK`, and `Overall Rank`.

### Optional fields

The current model can retain:

- NFL Team
- Position Rank
- Tier
- ADP
- Projected Points
- Notes

Future imports may add auction value, bye week, custom tags, ceiling/floor metrics, and provider IDs.

### Import behavior

The importer should:

1. Read the first worksheet.
2. Normalize header names.
3. Resolve known aliases.
4. Validate the minimum required fields.
5. Normalize positions.
6. Skip malformed rows with explicit warnings.
7. Detect duplicate player/position pairs.
8. Sort the resulting pool by the user's overall rank.

The original ranking values should not be mutated by the recommendation engine.

---

## 6. Draft-state model

The current draft state is represented by:

```text
DraftConfig
- teamCount
- userDraftSlot
- QB starters
- RB starters
- WR starters
- TE starters
- FLEX starters

DraftPick
- overallPick
- round
- pickInRound
- draftSlot
- playerId
```

The snake-order engine must correctly calculate:

- round from overall pick
- pick-in-round
- draft slot on the clock
- overall pick for a round/slot combination
- user's next selection

These calculations are foundational and should remain heavily unit tested.

---

## 7. Recommendation engine V1

The current engine scores every available player and ranks the candidates.

Initial factors:

```text
Ranking Value   50%
Roster Fit      20%
Tier Urgency    15%
Value at Pick   15%
```

These weights are starting values, not permanent product assumptions.

### Ranking value

Ranking value is based on the player's position within the user's ranking set and remains the strongest baseline signal.

### Roster fit

Roster fit considers the user's current positional composition and configured starting requirements. Early in a draft, raw value should remain important; roster need becomes more meaningful as starting slots fill.

### Tier urgency

When tier data exists, the engine increases urgency as the number of remaining players in a tier falls. A final player in a tier should receive a material boost.

### Value at pick

The engine considers the gap between the player's ranking and the user's upcoming selection. A highly ranked player who has fallen should receive a value bonus.

### Explainability

Every recommendation should retain component-level information and reason codes. Example reasons include:

- `13 picks of ranking value at your next selection`
- `Fills a priority WR starter slot`
- `Final RB remaining in Tier 3`
- `Among the strongest remaining values in your rankings`

The UI should never show a mysterious final score without the underlying reasons.

---

## 8. Recommendation strength

The displayed percentage is a presentation layer over the raw score.

It is **not**:

- a win probability
- a player projection confidence interval
- an injury probability
- a guarantee that the player is the objectively correct pick

Use the label **Recommendation Strength** throughout the product.

The top-three percentages do not need to sum to 100.

---

## 9. Next implementation milestones

### Milestone A — Real spreadsheet fixture

Use the user's actual ranking spreadsheet to harden the importer.

Tasks:

- verify real column names
- add missing aliases
- inspect tier and ADP availability
- handle ranking-provider formatting quirks
- add spreadsheet regression fixtures

Exit criterion: the real ranking spreadsheet imports without manual cleanup.

### Milestone B — League and roster configuration

Expand setup beyond team count and draft slot.

Add:

- scoring format
- QB/RB/WR/TE/FLEX starter counts
- bench size
- optional SUPERFLEX
- league presets
- saved custom configuration

### Milestone C — Recommendation engine V2

Add:

- positional scarcity
- strategy fit
- draft-trend detection
- position runs
- stronger roster-construction logic
- configurable strategy profiles such as Hero RB, Zero RB, Robust RB, WR Heavy, Late QB, and Balanced

Every new factor should expose its contribution in debug output and have scenario-based regression tests.

### Milestone D — Draft alerts

Add informational alerts such as:

- final player in tier
- positional run
- strong value fall
- position scarcity
- safe-to-wait signal
- unmet starting-roster need

Alerts should inform decisions rather than override the ranking engine.

### Milestone E — Future availability

Estimate whether a candidate is likely to survive until the user's next pick.

Inputs can include:

- player rank
- ADP when supplied
- number of intervening selections
- opponent roster needs
- recent position runs

Initially expose calibrated categories such as `Likely`, `Uncertain`, and `Unlikely` before presenting overly precise probabilities.

### Milestone F — Opponent modeling and simulation

Track every opponent roster and model likely positional demand.

Later, run Monte Carlo simulations for each candidate:

```text
Draft candidate now
    ↓
Simulate intervening picks
    ↓
Evaluate board at user's next pick
    ↓
Repeat
```

This lets the system optimize sequences rather than simply selecting the best current player.

### Milestone G — AI companion

Add conversational capabilities only after deterministic recommendation context is mature.

Useful questions include:

- Why this player over another?
- Can I afford to wait on QB?
- What position is drying up?
- What happens if I draft a TE here?
- Prioritize upside for the rest of the draft.

The AI layer should consume structured draft state and recommendation outputs rather than re-ranking the entire player pool itself.

### Milestone H — RosterPilot/provider integration

Once the standalone experience is validated:

- extract reusable engine modules into a shared package
- add persistence and saved drafts
- integrate user accounts
- add provider adapters
- synchronize draft state from supported providers
- embed Draft Companion into the main RosterPilot web/mobile experience

Provider-specific code should remain outside the core draft engine.

---

## 10. Testing strategy

### Unit tests

Prioritize:

- snake-order calculations
- next-user-pick calculation
- spreadsheet header normalization
- duplicate detection
- position normalization
- drafted-player exclusion
- tier urgency
- roster-fit scoring
- recommendation ordering

### Recommendation regression tests

Use fixed draft scenarios to prevent weight changes from producing surprising recommendations.

Example:

```text
Given:
- user has RB, WR, WR
- final Tier-3 WR is available
- several similar Tier-4 RBs remain

Expected:
- Tier-3 WR appears in the top three
- tier urgency reason is present
```

### End-to-end tests

Add browser tests for:

```text
import rankings
→ configure draft
→ enter picks
→ recommendations update
→ drafted player disappears
→ roster updates
→ undo restores state
```

---

## 11. Engineering decisions

1. **Keep player identity separate from rankings** when persistence is introduced so multiple ranking sets can coexist.
2. **Keep recommendation math framework-neutral** so it can move out of the standalone app cleanly.
3. **Preserve component scores and reasons**, not just the final percentage.
4. **Do not require an LLM for the core draft experience.**
5. **Treat external providers as adapters**, not as the domain model.
6. **Avoid premature real-time infrastructure.** Local state/HTTP is sufficient until multi-client synchronization is required.
7. **Make undo/correction reliable from the beginning.** Manual entry mistakes are expected during live drafts.
8. **Use the user's real rankings as the first product fixture.** The data contract should follow actual input rather than an invented provider schema.

---

## 12. Definition of the first useful release

**Draft Companion v0.1** is ready when a user can:

1. Open the standalone RosterPilot Draft Companion web app.
2. Upload a real ranking spreadsheet.
3. Configure a snake draft.
4. Enter picks quickly as they occur.
5. See remaining players and their roster update correctly.
6. Undo an incorrect pick.
7. Receive three transparent recommendations based primarily on their rankings plus live draft context.
8. Understand why each recommendation was made.

That is the first product boundary. Provider integration, simulation, and conversational AI should build on top of a draft workflow that is already useful on its own.
