const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';

export const FANTASYPROS_NFL_PROJECTION_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;
export type FantasyProsNflProjectionPosition = (typeof FANTASYPROS_NFL_PROJECTION_POSITIONS)[number];

export const FANTASYPROS_NEWS_CATEGORIES = ['injury', 'recap', 'transaction', 'rumor', 'breaking'] as const;
export type FantasyProsNewsCategory = (typeof FANTASYPROS_NEWS_CATEGORIES)[number];

export interface FantasyProsProjectionPlayer {
  fpid?: number;
  player_id?: number;
  name?: string;
  position_id?: string;
  team_id?: string;
  stats?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FantasyProsProjectionResponse {
  season?: number | string;
  week?: number | string;
  count?: number | string;
  positions?: string;
  scoring?: string;
  players?: FantasyProsProjectionPlayer[];
  [key: string]: unknown;
}

export interface FantasyProsProjectionDiagnostic {
  season: number | string | null;
  week: number | string | null;
  position: string | null;
  scoring: string | null;
  declaredCount: number | null;
  receivedPlayerCount: number;
  appearsTruncated: boolean | null;
  topLevelKeys: string[];
  playerKeys: string[];
  statKeys: string[];
  samplePlayers: Array<{
    fpid: number | null;
    name: string;
    position: string | null;
    team: string | null;
    projectedPoints: number | null;
    projectedHalfPprPoints: number | null;
    projectedPprPoints: number | null;
  }>;
}

export interface FantasyProsNewsItem {
  id?: number | string;
  created?: string;
  created_formated?: string;
  author?: string;
  player_id?: number | string;
  fpid?: number | string;
  team_id?: string;
  title?: string;
  sport_id?: string;
  categories?: unknown;
  link?: string;
  desc?: string;
  description?: string;
  impact?: string;
  fantasy_impact?: string;
  [key: string]: unknown;
}

export interface FantasyProsNewsResponse {
  sport?: string;
  title?: string;
  description?: string;
  count?: number | string;
  items?: FantasyProsNewsItem[];
  public_api_limited?: boolean;
  [key: string]: unknown;
}

export interface FantasyProsNewsDiagnostic {
  sport: string | null;
  declaredCount: number | null;
  receivedItemCount: number;
  appearsTruncated: boolean | null;
  publicApiLimited: boolean | null;
  topLevelKeys: string[];
  itemKeys: string[];
  hasDescriptionContent: boolean;
  hasImpactContent: boolean;
  sampleItems: Array<{
    id: number | string | null;
    playerId: number | null;
    team: string | null;
    title: string;
    created: string | null;
    categories: string[];
    link: string | null;
    descriptionSnippet: string | null;
    impactSnippet: string | null;
  }>;
}

export class FantasyProsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'FantasyProsApiError';
  }
}

export function isFantasyProsProjectionPosition(value: string): value is FantasyProsNflProjectionPosition {
  return (FANTASYPROS_NFL_PROJECTION_POSITIONS as readonly string[]).includes(value);
}

export function isFantasyProsNewsCategory(value: string): value is FantasyProsNewsCategory {
  return (FANTASYPROS_NEWS_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Parses a diagnostic query string such as `19799:12345` or `19799,12345`.
 * FantasyPros accepts colon-delimited player IDs. We cap diagnostics at 10
 * players so a local inspection endpoint cannot accidentally request a large
 * response or become a generic API proxy.
 */
export function parseFantasyProsPlayerIds(value: string | null): number[] {
  if (!value?.trim()) return [];
  const pieces = value.split(/[,:]/).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length > 10) throw new Error('At most 10 FantasyPros player IDs may be requested at once.');

  const ids = pieces.map((piece) => Number(piece));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('FantasyPros player IDs must be positive integers.');
  }
  return [...new Set(ids)];
}

export async function fetchFantasyProsPreseasonProjections(args: {
  apiKey: string;
  season: number;
  position: FantasyProsNflProjectionPosition;
  playerIds?: readonly number[];
  signal?: AbortSignal;
}): Promise<FantasyProsProjectionResponse> {
  const url = new URL(`${FANTASYPROS_BASE_URL}/nfl/${args.season}/projections`);
  url.searchParams.set('position', args.position);
  url.searchParams.set('week', '0');
  if (args.playerIds?.length) {
    url.searchParams.set('players', args.playerIds.join(':'));
  }

  return fantasyProsJsonRequest<FantasyProsProjectionResponse>(url, args.apiKey, args.signal);
}

export async function fetchFantasyProsNflNews(args: {
  apiKey: string;
  fpid?: number;
  category?: FantasyProsNewsCategory;
  limit?: number;
  signal?: AbortSignal;
}): Promise<FantasyProsNewsResponse> {
  const limit = args.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new Error('FantasyPros news diagnostic limit must be an integer from 1 to 25.');
  }
  if (args.fpid != null && (!Number.isInteger(args.fpid) || args.fpid <= 0)) {
    throw new Error('FantasyPros news player ID must be a positive integer.');
  }

  const url = new URL(`${FANTASYPROS_BASE_URL}/nfl/news`);
  url.searchParams.set('limit', String(limit));
  if (args.fpid != null) url.searchParams.set('fpid', String(args.fpid));
  if (args.category) url.searchParams.set('category', args.category);

  return fantasyProsJsonRequest<FantasyProsNewsResponse>(url, args.apiKey, args.signal);
}

export function buildFantasyProsProjectionDiagnostic(
  payload: FantasyProsProjectionResponse,
): FantasyProsProjectionDiagnostic {
  const players = Array.isArray(payload.players) ? payload.players : [];
  const declaredCount = finiteNumber(payload.count);
  const firstPlayer = players[0];
  const firstStats = Array.isArray(firstPlayer?.stats) ? firstPlayer.stats[0] : undefined;

  return {
    season: scalar(payload.season),
    week: scalar(payload.week),
    position: typeof payload.positions === 'string' ? payload.positions : null,
    scoring: typeof payload.scoring === 'string' ? payload.scoring : null,
    declaredCount,
    receivedPlayerCount: players.length,
    appearsTruncated: declaredCount == null ? null : players.length < declaredCount,
    topLevelKeys: Object.keys(payload).sort(),
    playerKeys: firstPlayer ? Object.keys(firstPlayer).sort() : [],
    statKeys: firstStats && typeof firstStats === 'object' ? Object.keys(firstStats).sort() : [],
    samplePlayers: players.slice(0, 5).map((player) => {
      const stats = Array.isArray(player.stats) ? player.stats[0] : undefined;
      return {
        fpid: finiteNumber(player.fpid ?? player.player_id),
        name: typeof player.name === 'string' ? player.name : 'Unknown player',
        position: typeof player.position_id === 'string' ? player.position_id : null,
        team: typeof player.team_id === 'string' ? player.team_id : null,
        projectedPoints: finiteNumber(stats?.points),
        projectedHalfPprPoints: finiteNumber(stats?.points_half),
        projectedPprPoints: finiteNumber(stats?.points_ppr),
      };
    }),
  };
}

export function buildFantasyProsNewsDiagnostic(payload: FantasyProsNewsResponse): FantasyProsNewsDiagnostic {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const declaredCount = finiteNumber(payload.count);
  const firstItem = items[0];
  const sampleItems = items.slice(0, 5).map((item) => {
    const description = firstString(item.desc, item.description);
    const impact = firstString(item.impact, item.fantasy_impact);
    return {
      id: scalar(item.id),
      playerId: finiteNumber(item.player_id ?? item.fpid),
      team: typeof item.team_id === 'string' ? item.team_id : null,
      title: typeof item.title === 'string' ? item.title : 'Untitled news item',
      created: typeof item.created === 'string' ? item.created : null,
      categories: stringArray(item.categories),
      link: typeof item.link === 'string' ? item.link : null,
      descriptionSnippet: description ? textSnippet(description) : null,
      impactSnippet: impact ? textSnippet(impact) : null,
    };
  });

  return {
    sport: typeof payload.sport === 'string' ? payload.sport : null,
    declaredCount,
    receivedItemCount: items.length,
    appearsTruncated: declaredCount == null ? null : items.length < declaredCount,
    publicApiLimited: typeof payload.public_api_limited === 'boolean' ? payload.public_api_limited : null,
    topLevelKeys: Object.keys(payload).sort(),
    itemKeys: firstItem ? Object.keys(firstItem).sort() : [],
    hasDescriptionContent: sampleItems.some((item) => Boolean(item.descriptionSnippet)),
    hasImpactContent: sampleItems.some((item) => Boolean(item.impactSnippet)),
    sampleItems,
  };
}

async function fantasyProsJsonRequest<T>(url: URL, apiKey: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    const safeDetail = body.slice(0, 300).replace(/\s+/g, ' ').trim();
    throw new FantasyProsApiError(
      `FantasyPros returned HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : ''}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function scalar(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function textSnippet(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
