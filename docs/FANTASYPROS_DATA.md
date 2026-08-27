# FantasyPros projection data prototype

RosterPilot uses FantasyPros as a server-side data source for richer player profiles. API keys must never be exposed to the browser or committed to Git.

## Local setup

Create `apps/draft-companion/.env.local`:

```env
FANTASYPROS_API_KEY=your_key_here
```

The repository ignores `.env` and `.env.*` files. Only the variable name is documented in `.env.example`.

Restart the Next.js development server after creating or changing `.env.local`:

```bash
npm run dev:draft
```

## One-request diagnostic

The prototype exposes a server-only diagnostic route that makes exactly one FantasyPros request and returns only response metadata plus five sample players:

```text
/api/fantasypros/diagnostic?position=WR&season=2026
```

Supported positions are `QB`, `RB`, `WR`, `TE`, `K`, and `DST`. The route uses preseason projections (`week=0`).

The response reports:

- FantasyPros' declared `count`;
- the number of player objects actually received;
- whether the response appears truncated (`receivedPlayerCount < declaredCount`);
- top-level, player, and stat field names;
- up to five sample players with standard, half-PPR, and PPR projected points when those fields are present.

The route never returns or logs the API key and intentionally does not return the complete projection payload. This keeps the free 50-request/day prototype quota easy to inspect without accidentally spending multiple calls at once.

## Intended production architecture

FantasyPros data will be fetched and cached server-side. RosterPilot's deterministic recommendation engine remains authoritative. A future AI coach can receive a compact, validated player-profile snapshot containing only the relevant available players, current roster, draft state, projections, injuries/news, and deterministic recommendation signals.

The LLM must not invent player facts that are absent from the supplied profile data.
