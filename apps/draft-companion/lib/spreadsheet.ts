import * as XLSX from 'xlsx';
import type { PlayerRanking, Position } from './types';

const VALID_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);

const HEADER_ALIASES = {
  name: ['player', 'player name', 'name'],
  position: ['position', 'pos'],
  overallRank: ['rank', 'rk', 'overall rank', 'overall_rank'],
  nflTeam: ['team', 'nfl team', 'tm'],
  positionRank: ['position rank', 'pos rank', 'pos rk'],
  tier: ['tier'],
  adp: ['adp'],
  projectedPoints: ['projected points', 'projection', 'points', 'proj pts'],
  notes: ['notes', 'note'],
} as const;

export interface RankingImportResult {
  players: PlayerRanking[];
  warnings: string[];
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

  if (rows.length === 0) throw new Error('The ranking sheet is empty.');

  const normalizedHeaders = new Map<string, string>();
  Object.keys(rows[0]).forEach((header) => normalizedHeaders.set(normalizeHeader(header), header));

  const nameHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.name);
  const positionHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.position);
  const rankHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.overallRank);

  if (!nameHeader || !positionHeader || !rankHeader) {
    throw new Error('Required columns were not found. Include Player, Position, and Rank columns.');
  }

  const warnings: string[] = [];
  const seen = new Set<string>();
  const players: PlayerRanking[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cleanString(row[nameHeader]);
    const positionRaw = normalizePosition(cleanString(row[positionHeader]));
    const rank = toNumber(row[rankHeader]);

    if (!name || !positionRaw || !VALID_POSITIONS.has(positionRaw) || rank == null) {
      warnings.push(`Skipped row ${rowNumber}: missing/invalid player, position, or rank.`);
      return;
    }

    const duplicateKey = `${normalizeHeader(name)}|${positionRaw}`;
    if (seen.has(duplicateKey)) {
      warnings.push(`Skipped row ${rowNumber}: duplicate ${name} (${positionRaw}).`);
      return;
    }
    seen.add(duplicateKey);

    const optional = (field: keyof typeof HEADER_ALIASES) =>
      resolveHeader(normalizedHeaders, HEADER_ALIASES[field]);

    players.push({
      id: stableId(name, positionRaw),
      name,
      position: positionRaw,
      overallRank: rank,
      nflTeam: optional('nflTeam') ? cleanString(row[optional('nflTeam')!]) || undefined : undefined,
      positionRank: optional('positionRank') ? toNumber(row[optional('positionRank')!]) ?? undefined : undefined,
      tier: optional('tier') ? toNumber(row[optional('tier')!]) ?? undefined : undefined,
      adp: optional('adp') ? toNumber(row[optional('adp')!]) ?? undefined : undefined,
      projectedPoints: optional('projectedPoints')
        ? toNumber(row[optional('projectedPoints')!]) ?? undefined
        : undefined,
      notes: optional('notes') ? cleanString(row[optional('notes')!]) || undefined : undefined,
    });
  });

  players.sort((a, b) => a.overallRank - b.overallRank || a.name.localeCompare(b.name));
  if (players.length === 0) throw new Error('No valid ranking rows were found.');

  return { players, warnings };
}

function resolveHeader(headers: Map<string, string>, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const actual = headers.get(normalizeHeader(alias));
    if (actual) return actual;
  }
  return undefined;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function cleanString(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function normalizePosition(value: string): Position | null {
  const normalized = value.trim().toUpperCase().replace(/\s/g, '');
  if (normalized === 'DEF' || normalized === 'D/ST' || normalized === 'D-ST') return 'DST';
  return VALID_POSITIONS.has(normalized as Position) ? (normalized as Position) : null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableId(name: string, position: string): string {
  return `${normalizeHeader(name).replace(/\s/g, '-')}-${position.toLowerCase()}`;
}
