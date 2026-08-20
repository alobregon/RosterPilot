import * as XLSX from 'xlsx';
import type { PlayerRanking, Position, RankingSourceMetadata } from './types';

const VALID_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);

const HEADER_ALIASES = {
  name: ['player', 'player name', 'name'],
  position: ['position', 'pos'],
  overallRank: ['rank', 'rk', 'overall rank', 'overall_rank'],
  nflTeam: ['team', 'nfl team', 'tm'],
  positionRank: ['position rank', 'pos rank', 'pos rk'],
  tier: ['tier', 'tiers'],
  adp: ['adp'],
  projectedPoints: ['projected points', 'projection', 'points', 'proj pts'],
  byeWeek: ['bye', 'bye week'],
  notes: ['notes', 'note'],
  upside: ['upside'],
  bust: ['bust'],
  strengthOfSchedule: ['sos', 'strength of schedule'],
  ecrVsAdp: ['ecr vs adp'],
  averageDifference: ['avg diff', 'average diff'],
  percentOver: ['over', 'percent over', '% over'],
} as const;

export interface RankingImportResult {
  players: PlayerRanking[];
  warnings: string[];
  detectedSource?: string;
}

export async function parseRankingFile(file: File): Promise<RankingImportResult> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The workbook does not contain a worksheet.');

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: null,
    raw: false,
  });

  return parseRankingRows(rows);
}

/**
 * Converts provider/custom ranking rows into RosterPilot's normalized player model.
 * Exported separately from parseRankingFile so provider formats can be regression-tested
 * without requiring browser File APIs.
 */
export function parseRankingRows(rows: Record<string, unknown>[]): RankingImportResult {
  if (rows.length === 0) throw new Error('The ranking sheet is empty.');

  const normalizedHeaders = new Map<string, string>();
  Object.keys(rows[0]).forEach((header) => normalizedHeaders.set(normalizeHeader(header), header));

  const nameHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.name);
  const positionHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.position);
  const rankHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.overallRank);

  if (!nameHeader || !positionHeader || !rankHeader) {
    throw new Error('Required columns were not found. Include Player, Position, and Rank columns.');
  }

  const detectedSource = detectSource(normalizedHeaders);
  const warnings: string[] = [];
  const seen = new Set<string>();
  const players: PlayerRanking[] = [];

  const optional = (field: keyof typeof HEADER_ALIASES) =>
    resolveHeader(normalizedHeaders, HEADER_ALIASES[field]);
  const teamHeader = optional('nflTeam');

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cleanString(row[nameHeader]);
    const parsedPosition = parsePosition(cleanString(row[positionHeader]));
    const rank = toNumber(row[rankHeader]);
    const nflTeam = teamHeader ? cleanString(row[teamHeader]) || undefined : undefined;

    if (!name || !parsedPosition || rank == null) {
      warnings.push(`Skipped row ${rowNumber}: missing/invalid player, position, or rank.`);
      return;
    }

    // FantasyPros abbreviates first names, so name + position alone is not unique
    // in deep ranking exports. Team is part of the import identity until provider
    // player IDs are available. This keeps distinct J. Taylor-style collisions.
    const duplicateKey = identityKey(name, parsedPosition.position, nflTeam);
    if (seen.has(duplicateKey)) {
      warnings.push(
        `Skipped row ${rowNumber}: duplicate ${name} (${parsedPosition.position}${
          nflTeam ? `, ${nflTeam}` : ''
        }).`,
      );
      return;
    }
    seen.add(duplicateKey);

    const explicitPositionRankHeader = optional('positionRank');
    const sourceMetadata = buildSourceMetadata(row, normalizedHeaders, detectedSource);

    players.push({
      id: stableId(name, parsedPosition.position, nflTeam),
      name,
      position: parsedPosition.position,
      overallRank: rank,
      nflTeam,
      positionRank: explicitPositionRankHeader
        ? toNumber(row[explicitPositionRankHeader]) ?? parsedPosition.positionRank
        : parsedPosition.positionRank,
      tier: optional('tier') ? toNumber(row[optional('tier')!]) ?? undefined : undefined,
      adp: optional('adp') ? toNumber(row[optional('adp')!]) ?? undefined : undefined,
      projectedPoints: optional('projectedPoints')
        ? toNumber(row[optional('projectedPoints')!]) ?? undefined
        : undefined,
      byeWeek: optional('byeWeek') ? toNumber(row[optional('byeWeek')!]) ?? undefined : undefined,
      notes: optional('notes') ? cleanString(row[optional('notes')!]) || undefined : undefined,
      sourceMetadata: Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
    });
  });

  players.sort((a, b) => a.overallRank - b.overallRank || a.name.localeCompare(b.name));
  if (players.length === 0) throw new Error('No valid ranking rows were found.');

  return { players, warnings, detectedSource };
}

function resolveHeader(headers: Map<string, string>, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const actual = headers.get(normalizeHeader(alias));
    if (actual) return actual;
  }
  return undefined;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanString(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function parsePosition(value: string): { position: Position; positionRank?: number } | null {
  const normalized = value.trim().toUpperCase().replace(/\s/g, '');

  const defenseMatch = normalized.match(/^(?:DST|DEF|D\/ST|D-ST)(\d+)?$/);
  if (defenseMatch) {
    return { position: 'DST', positionRank: defenseMatch[1] ? Number(defenseMatch[1]) : undefined };
  }

  const match = normalized.match(/^(QB|RB|WR|TE|K)(\d+)?$/);
  if (!match) return null;

  const position = match[1] as Position;
  if (!VALID_POSITIONS.has(position)) return null;

  return {
    position,
    positionRank: match[2] ? Number(match[2]) : undefined,
  };
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/[^0-9.+-]/g, '');
  if (!normalized || normalized === '+' || normalized === '-' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFivePointRating(value: unknown): number | undefined {
  const text = cleanString(value);
  if (!text) return undefined;
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*out\s*of\s*5/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePercentOver(value: unknown): Pick<
  RankingSourceMetadata,
  'percentOverConsensus' | 'percentOverCount' | 'percentOverTotal'
> {
  const text = cleanString(value);
  if (!text) return {};

  const match = text.match(/([0-9]+(?:\.[0-9]+)?)%\s*(?:\(([0-9]+)\s*\/\s*([0-9]+)\))?/);
  if (!match) return {};

  return {
    percentOverConsensus: Number(match[1]),
    percentOverCount: match[2] ? Number(match[2]) : undefined,
    percentOverTotal: match[3] ? Number(match[3]) : undefined,
  };
}

function detectSource(headers: Map<string, string>): string | undefined {
  const fantasyProsSignals = ['player name', 'tiers', 'ecr vs adp'];
  return fantasyProsSignals.every((signal) => headers.has(normalizeHeader(signal)))
    ? 'FantasyPros'
    : undefined;
}

function buildSourceMetadata(
  row: Record<string, unknown>,
  headers: Map<string, string>,
  detectedSource?: string,
): RankingSourceMetadata {
  const header = (field: keyof typeof HEADER_ALIASES) => resolveHeader(headers, HEADER_ALIASES[field]);
  const value = (field: keyof typeof HEADER_ALIASES) => {
    const resolved = header(field);
    return resolved ? row[resolved] : undefined;
  };

  const metadata: RankingSourceMetadata = {};
  if (detectedSource) metadata.provider = detectedSource;

  const upsideRating = parseFivePointRating(value('upside'));
  const bustRating = parseFivePointRating(value('bust'));
  const strengthOfScheduleRating = parseFivePointRating(value('strengthOfSchedule'));
  const ecrVsAdp = toNumber(value('ecrVsAdp'));
  const averageDifference = toNumber(value('averageDifference'));

  if (upsideRating != null) metadata.upsideRating = upsideRating;
  if (bustRating != null) metadata.bustRating = bustRating;
  if (strengthOfScheduleRating != null) metadata.strengthOfScheduleRating = strengthOfScheduleRating;
  if (ecrVsAdp != null) metadata.ecrVsAdp = ecrVsAdp;
  if (averageDifference != null) metadata.averageDifference = averageDifference;

  Object.assign(metadata, parsePercentOver(value('percentOver')));
  return metadata;
}

function identityKey(name: string, position: Position, nflTeam?: string): string {
  return [normalizeHeader(name), position.toLowerCase(), normalizeHeader(nflTeam ?? '')].join('|');
}

function stableId(name: string, position: Position, nflTeam?: string): string {
  const teamSuffix = nflTeam ? `-${normalizeHeader(nflTeam).replace(/\s/g, '-')}` : '';
  return `${normalizeHeader(name).replace(/\s/g, '-')}-${position.toLowerCase()}${teamSuffix}`;
}
