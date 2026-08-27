import {
  buildFantasyProsProjectionDiagnostic,
  FantasyProsApiError,
  fetchFantasyProsPreseasonProjections,
  isFantasyProsProjectionPosition,
} from '@/lib/fantasypros';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = process.env.FANTASYPROS_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: 'FANTASYPROS_API_KEY is not configured on the server.',
        hint: 'Add it to apps/draft-companion/.env.local and restart npm run dev:draft.',
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const position = (url.searchParams.get('position') ?? 'WR').toUpperCase();
  const seasonText = url.searchParams.get('season') ?? '2026';
  const season = Number(seasonText);

  if (!isFantasyProsProjectionPosition(position)) {
    return Response.json(
      {
        ok: false,
        error: `Unsupported position '${position}'. Use QB, RB, WR, TE, K, or DST.`,
      },
      { status: 400 },
    );
  }
  if (!Number.isInteger(season) || season < 2012 || season > 2100) {
    return Response.json(
      {
        ok: false,
        error: `Invalid season '${seasonText}'.`,
      },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchFantasyProsPreseasonProjections({ apiKey, season, position });
    return Response.json({
      ok: true,
      request: {
        season,
        week: 0,
        position,
        fantasyProsRequestsUsed: 1,
      },
      diagnostic: buildFantasyProsProjectionDiagnostic(payload),
      note: 'This endpoint intentionally returns only metadata and five sample players, never the API key or full projection payload.',
    });
  } catch (error) {
    if (error instanceof FantasyProsApiError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          upstreamStatus: error.status,
        },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'FantasyPros request failed.',
      },
      { status: 502 },
    );
  }
}
