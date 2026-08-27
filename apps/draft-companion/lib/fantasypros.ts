const FANTASYPROS_BASE_URL = 'https://api.fantasypros.com/public/v2/json';

export const FANTASYPROS_NFL_PROJECTION_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;
export type FantasyProsNflProjectionPosition = (typeof FANTASYPROS_NFL_PROJECTION_POSITIONS)[number];

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

  const response = await fetch(url, {
    headers: {
      'x-api-key': args.apiKey,
      accept: 'application/json',
    },
    cache: 'no-store',
    signal: args.signal,
  });

  if (!response.ok) {
    const body = await response.text();
    const safeDetail = body.slice(0, 300).replace(/\s+/g, ' ').trim();
    throw new FantasyProsApiError(
      `FantasyPros returned HTTP ${response.status}${safeDetail ? `: ${safeDetail}` : ''}`,
      response.status,
    );
  }

  return (await response.json()) as FantasyProsProjectionResponse;
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

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function scalar(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}
