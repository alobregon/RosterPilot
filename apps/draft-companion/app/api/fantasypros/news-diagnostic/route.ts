import {
  buildFantasyProsNewsDiagnostic,
  FantasyProsApiError,
  fetchFantasyProsNflNews,
  isFantasyProsNewsCategory,
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
  const fpidText = url.searchParams.get('fpid');
  const categoryText = url.searchParams.get('category')?.trim().toLowerCase() ?? '';
  const limitText = url.searchParams.get('limit') ?? '10';
  const limit = Number(limitText);

  let fpid: number | undefined;
  if (fpidText?.trim()) {
    fpid = Number(fpidText);
    if (!Number.isInteger(fpid) || fpid <= 0) {
      return Response.json(
        { ok: false, error: `Invalid FantasyPros player ID '${fpidText}'.` },
        { status: 400 },
      );
    }
  }

  if (categoryText && !isFantasyProsNewsCategory(categoryText)) {
    return Response.json(
      {
        ok: false,
        error: `Unsupported news category '${categoryText}'. Use injury, recap, transaction, rumor, or breaking.`,
      },
      { status: 400 },
    );
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    return Response.json(
      { ok: false, error: `Invalid limit '${limitText}'. Use an integer from 1 to 25.` },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchFantasyProsNflNews({
      apiKey,
      fpid,
      category: categoryText || undefined,
      limit,
    });

    return Response.json({
      ok: true,
      request: {
        sport: 'NFL',
        fpid: fpid ?? null,
        category: categoryText || null,
        limit,
        fantasyProsRequestsUsed: 1,
      },
      diagnostic: buildFantasyProsNewsDiagnostic(payload),
      note: 'This endpoint returns only field metadata and up to five short news snippets. It never returns the API key or the full provider payload.',
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
        error: error instanceof Error ? error.message : 'FantasyPros news request failed.',
      },
      { status: 502 },
    );
  }
}
