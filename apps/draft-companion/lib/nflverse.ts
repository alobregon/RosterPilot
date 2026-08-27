const NFLVERSE_PLAYER_STATS_BASE_URL =
  'https://github.com/nflverse/nflverse-data/releases/download/stats_player';

export const NFLVERSE_PROFILE_MAX_SEASONS = 5;
export const NFLVERSE_PLAYER_STATS_MIN_SEASON = 1999;

export interface NflversePlayerStatRow {
  player_id?: string;
  player_name?: string;
  player_display_name?: string;
  position?: string;
  position_group?: string;
  season?: string;
  season_type?: string;
  team?: string;
  games?: string;
  completions?: string;
  attempts?: string;
  passing_yards?: string;
  passing_tds?: string;
  passing_interceptions?: string;
  carries?: string;
  rushing_yards?: string;
  rushing_tds?: string;
  receptions?: string;
  targets?: string;
  receiving_yards?: string;
  receiving_tds?: string;
  fantasy_points?: string;
  fantasy_points_ppr?: string;
  [key: string]: string | undefined;
}

export interface HistoricalPlayerSeason {
  season: number;
  team: string | null;
  position: string | null;
  games: number | null;
  passing: {
    attempts: number | null;
    completions: number | null;
    yards: number | null;
    touchdowns: number | null;
    interceptions: number | null;
  };
  rushing: {
    carries: number | null;
    yards: number | null;
    touchdowns: number | null;
  };
  receiving: {
    targets: number | null;
    receptions: number | null;
    yards: number | null;
    touchdowns: number | null;
  };
  fantasy: {
    standardPoints: number | null;
    halfPprPoints: number | null;
    pprPoints: number | null;
  };
  perGame: {
    targets: number | null;
    receptions: number | null;
    receivingYards: number | null;
    carries: number | null;
    rushingYards: number | null;
    halfPprPoints: number | null;
  };
}

export interface HistoricalPlayerProfile {
  playerId: string;
  playerName: string;
  position: string | null;
  recentTeam: string | null;
  seasons: HistoricalPlayerSeason[];
}

export interface NflverseSeasonRows {
  season: number;
  rows: NflversePlayerStatRow[];
  sourceUrl?: string;
}

export class NflverseDataError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'NflverseDataError';
  }
}

export class NflverseAmbiguousPlayerError extends Error {
  constructor(public readonly candidates: Array<{ playerId: string; playerName: string; position: string | null }>) {
    super('Multiple nflverse players matched the requested name. Add a position to disambiguate.');
    this.name = 'NflverseAmbiguousPlayerError';
  }
}

export function nflverseRegularSeasonStatsUrl(season: number): string {
  return `${NFLVERSE_PLAYER_STATS_BASE_URL}/stats_player_reg_${season}.csv`;
}

export async function fetchNflverseRegularSeasonStats(
  season: number,
  signal?: AbortSignal,
): Promise<NflverseSeasonRows> {
  const sourceUrl = nflverseRegularSeasonStatsUrl(season);
  const response = await fetch(sourceUrl, {
    headers: { accept: 'text/csv' },
    next: { revalidate: 21_600 },
    signal,
  });

  if (!response.ok) {
    throw new NflverseDataError(`nflverse returned HTTP ${response.status} for the ${season} player stats.`, response.status);
  }

  return {
    season,
    rows: parseNflversePlayerStatsCsv(await response.text()),
    sourceUrl,
  };
}

export function parseNflversePlayerStatsCsv(csv: string): NflversePlayerStatRow[] {
  const records = parseCsvRecords(csv);
  if (records.length === 0) return [];

  const headers = records[0].map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, '').trim() : value.trim(),
  );
  if (!headers.includes('player_id') || !headers.includes('player_display_name')) {
    throw new NflverseDataError('The nflverse player-stats CSV is missing required player identity columns.', 502);
  }

  return records.slice(1).flatMap((record) => {
    if (record.every((value) => value.trim() === '')) return [];
    const row: NflversePlayerStatRow = {};
    headers.forEach((header, index) => {
      if (header) row[header] = record[index] ?? '';
    });
    return [row];
  });
}

export function normalizeNflversePlayerName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNflverseSeasons(
  raw: string | null,
  currentYear = new Date().getUTCFullYear(),
): number[] {
  if (!raw?.trim()) return [currentYear - 1, currentYear - 2, currentYear - 3];

  const parts = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > NFLVERSE_PROFILE_MAX_SEASONS) {
    throw new Error(`Request between 1 and ${NFLVERSE_PROFILE_MAX_SEASONS} seasons.`);
  }

  const seasons = parts.map((value) => Number(value));
  if (seasons.some((season) => !Number.isInteger(season) || season < NFLVERSE_PLAYER_STATS_MIN_SEASON || season > currentYear)) {
    throw new Error(`Seasons must be whole years from ${NFLVERSE_PLAYER_STATS_MIN_SEASON} through ${currentYear}.`);
  }

  return [...new Set(seasons)].sort((a, b) => b - a);
}

export function buildNflverseHistoricalProfile(args: {
  playerName: string;
  position?: string | null;
  seasonRows: readonly NflverseSeasonRows[];
}): HistoricalPlayerProfile | null {
  const requestedName = normalizeNflversePlayerName(args.playerName);
  const requestedPosition = args.position?.trim().toUpperCase() || null;
  const candidateRows = args.seasonRows.flatMap(({ rows }) =>
    rows.filter((row) => {
      const displayName = normalizeNflversePlayerName(row.player_display_name ?? '');
      if (displayName !== requestedName) return false;
      return !requestedPosition || (row.position ?? '').toUpperCase() === requestedPosition;
    }),
  );

  if (candidateRows.length === 0) return null;

  const identities = new Map<string, { playerName: string; position: string | null }>();
  for (const row of candidateRows) {
    const playerId = row.player_id?.trim();
    if (!playerId) continue;
    identities.set(playerId, {
      playerName: row.player_display_name?.trim() || row.player_name?.trim() || args.playerName,
      position: row.position?.trim() || null,
    });
  }

  if (identities.size === 0) return null;
  if (identities.size > 1) {
    throw new NflverseAmbiguousPlayerError(
      [...identities].map(([playerId, identity]) => ({ playerId, ...identity })),
    );
  }

  const [playerId, identity] = [...identities][0];
  const seasons = args.seasonRows
    .map(({ season, rows }) => aggregateSeason(season, rows.filter((row) => row.player_id?.trim() === playerId)))
    .filter((season): season is HistoricalPlayerSeason => season !== null)
    .sort((a, b) => b.season - a.season);

  if (seasons.length === 0) return null;

  return {
    playerId,
    playerName: identity.playerName,
    position: identity.position,
    recentTeam: seasons[0].team,
    seasons,
  };
}

function aggregateSeason(season: number, rows: readonly NflversePlayerStatRow[]): HistoricalPlayerSeason | null {
  if (rows.length === 0) return null;

  const teams = [...new Set(rows.map((row) => row.team?.trim()).filter((team): team is string => Boolean(team)))];
  const position = rows.find((row) => row.position?.trim())?.position?.trim() || null;
  const games = sumField(rows, 'games');
  const receptions = sumField(rows, 'receptions');
  const fantasyPoints = sumField(rows, 'fantasy_points');
  const fantasyPointsPpr = sumField(rows, 'fantasy_points_ppr');
  const halfPprPoints = fantasyPoints == null || receptions == null ? null : fantasyPoints + receptions * 0.5;

  const receivingTargets = sumField(rows, 'targets');
  const receivingYards = sumField(rows, 'receiving_yards');
  const rushingCarries = sumField(rows, 'carries');
  const rushingYards = sumField(rows, 'rushing_yards');

  return {
    season,
    team: teams.length ? teams.join('/') : null,
    position,
    games,
    passing: {
      attempts: sumField(rows, 'attempts'),
      completions: sumField(rows, 'completions'),
      yards: sumField(rows, 'passing_yards'),
      touchdowns: sumField(rows, 'passing_tds'),
      interceptions: sumField(rows, 'passing_interceptions'),
    },
    rushing: {
      carries: rushingCarries,
      yards: rushingYards,
      touchdowns: sumField(rows, 'rushing_tds'),
    },
    receiving: {
      targets: receivingTargets,
      receptions,
      yards: receivingYards,
      touchdowns: sumField(rows, 'receiving_tds'),
    },
    fantasy: {
      standardPoints: fantasyPoints,
      halfPprPoints,
      pprPoints: fantasyPointsPpr,
    },
    perGame: {
      targets: perGame(receivingTargets, games),
      receptions: perGame(receptions, games),
      receivingYards: perGame(receivingYards, games),
      carries: perGame(rushingCarries, games),
      rushingYards: perGame(rushingYards, games),
      halfPprPoints: perGame(halfPprPoints, games),
    },
  };
}

function sumField(rows: readonly NflversePlayerStatRow[], field: keyof NflversePlayerStatRow): number | null {
  const values = rows.map((row) => finiteNumber(row[field])).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function perGame(value: number | null, games: number | null): number | null {
  if (value == null || games == null || games <= 0) return null;
  return Math.round((value / games) * 100) / 100;
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\n') {
      record.push(field.replace(/\r$/, ''));
      records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/, ''));
    records.push(record);
  }

  return records;
}
