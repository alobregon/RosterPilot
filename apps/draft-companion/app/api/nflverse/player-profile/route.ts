import {
  buildNflverseHistoricalProfile,
  fetchNflverseRegularSeasonStats,
  NflverseAmbiguousPlayerError,
  NflverseDataError,
  parseNflverseSeasons,
} from '@/lib/nflverse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROFILE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerName = url.searchParams.get('name')?.trim();
  const position = url.searchParams.get('position')?.trim().toUpperCase() || null;

  if (!playerName) {
    return Response.json(
      { ok: false, error: "Missing required 'name' query parameter." },
      { status: 400 },
    );
  }
  if (playerName.length > 120) {
    return Response.json({ ok: false, error: 'Player name is too long.' }, { status: 400 });
  }
  if (position && !PROFILE_POSITIONS.has(position)) {
    return Response.json(
      { ok: false, error: "Unsupported position. Use QB, RB, WR, TE, or K." },
      { status: 400 },
    );
  }

  let seasons: number[];
  try {
    seasons = parseNflverseSeasons(url.searchParams.get('seasons'));
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Invalid seasons.' },
      { status: 400 },
    );
  }

  try {
    const seasonRows = await Promise.all(seasons.map((season) => fetchNflverseRegularSeasonStats(season)));
    const profile = buildNflverseHistoricalProfile({
      playerName,
      position,
      seasonRows,
    });

    if (!profile) {
      return Response.json(
        {
          ok: false,
          error: 'No exact nflverse player match was found in the requested seasons.',
          query: { name: playerName, position, seasons },
        },
        { status: 404 },
      );
    }

    return Response.json({
      ok: true,
      query: { name: playerName, position, seasons },
      source: {
        provider: 'nflverse',
        dataset: 'player stats',
        summaryLevel: 'regular-season',
        dataKind: 'historical_actuals',
        sourceUrls: seasonRows.map((item) => item.sourceUrl),
        license: 'CC BY 4.0 (nflverse-data repository; review underlying-source rights before commercial use)',
      },
      profile,
      notes: [
        'These are historical actual NFL statistics, not future projections.',
        'Half-PPR points are derived as nflverse standard fantasy points + 0.5 points per reception.',
        'V1 intentionally excludes snap share, target share, routes, YPRR, and current news/injury context.',
      ],
    });
  } catch (error) {
    if (error instanceof NflverseAmbiguousPlayerError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          candidates: error.candidates,
        },
        { status: 409 },
      );
    }

    if (error instanceof NflverseDataError) {
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
        error: error instanceof Error ? error.message : 'Unable to build nflverse player profile.',
      },
      { status: 502 },
    );
  }
}
