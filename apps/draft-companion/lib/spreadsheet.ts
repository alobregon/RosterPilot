import * as XLSX from 'xlsx';
import type { PlayerRanking, Position, RankingSourceMetadata } from './types';

const VALID_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);
const HEADER_ALIASES = {
  name: ['player', 'player name', 'name'], position: ['position', 'pos'], overallRank: ['rank', 'rk', 'overall rank', 'overall_rank'],
  nflTeam: ['team', 'nfl team', 'tm'], positionRank: ['position rank', 'pos rank', 'pos rk'], tier: ['tier', 'tiers'], adp: ['adp'],
  projectedPoints: ['projected points', 'projection', 'points', 'proj pts'], byeWeek: ['bye', 'bye week'], notes: ['notes', 'note'],
  upside: ['upside'], bust: ['bust'], strengthOfSchedule: ['sos', 'strength of schedule'], ecrVsAdp: ['ecr vs adp'], averageDifference: ['avg diff', 'average diff'], percentOver: ['over', 'percent over', '% over'],
} as const;

export interface RankingImportResult { players: PlayerRanking[]; warnings: string[]; detectedSource?: string; }

export async function parseRankingFile(file: File): Promise<RankingImportResult> {
  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The workbook does not contain a worksheet.');
  return parseRankingRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: null, raw: false }));
}

export function parseRankingRows(rows: Record<string, unknown>[]): RankingImportResult {
  if (rows.length === 0) throw new Error('The ranking sheet is empty.');
  const normalizedHeaders = new Map<string, string>();
  Object.keys(rows[0]).forEach((header) => normalizedHeaders.set(normalizeHeader(header), header));
  const nameHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.name);
  const positionHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.position);
  const rankHeader = resolveHeader(normalizedHeaders, HEADER_ALIASES.overallRank);
  if (!nameHeader || !positionHeader || !rankHeader) throw new Error('Required columns were not found. Include Player, Position, and Rank columns.');

  const detectedSource = detectSource(normalizedHeaders);
  const warnings: string[] = [];
  const seen = new Set<string>();
  const players: PlayerRanking[] = [];
  const optional = (field: keyof typeof HEADER_ALIASES) => resolveHeader(normalizedHeaders, HEADER_ALIASES[field]);
  const teamHeader = optional('nflTeam');
  const explicitAdpHeader = optional('adp');
  const positionRankHeader = optional('positionRank');
  const tierHeader = optional('tier');
  const projectedHeader = optional('projectedPoints');
  const byeHeader = optional('byeWeek');
  const notesHeader = optional('notes');

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cleanString(row[nameHeader]);
    const parsedPosition = parsePosition(cleanString(row[positionHeader]));
    const rank = toNumber(row[rankHeader]);
    const nflTeam = teamHeader ? cleanString(row[teamHeader]) || undefined : undefined;
    if (!name || !parsedPosition || rank == null) { warnings.push(`Skipped row ${rowNumber}: missing/invalid player, position, or rank.`); return; }

    const duplicateKey = identityKey(name, parsedPosition.position, nflTeam);
    if (seen.has(duplicateKey)) { warnings.push(`Skipped row ${rowNumber}: duplicate ${name} (${parsedPosition.position}${nflTeam ? `, ${nflTeam}` : ''}).`); return; }
    seen.add(duplicateKey);

    const sourceMetadata = buildSourceMetadata(row, normalizedHeaders, detectedSource);
    const explicitAdp = explicitAdpHeader ? toNumber(row[explicitAdpHeader]) : null;
    const derivedAdp = explicitAdp == null && detectedSource === 'FantasyPros' && sourceMetadata.ecrVsAdp != null
      ? deriveAdpFromEcrDifference(rank, sourceMetadata.ecrVsAdp)
      : undefined;
    const adp = explicitAdp ?? derivedAdp;
    if (explicitAdp != null) sourceMetadata.adpSource = 'EXPLICIT';
    else if (derivedAdp != null) sourceMetadata.adpSource = 'DERIVED_ECR_VS_ADP';

    players.push({
      id: stableId(name, parsedPosition.position, nflTeam), name, position: parsedPosition.position, overallRank: rank, nflTeam,
      positionRank: positionRankHeader ? toNumber(row[positionRankHeader]) ?? parsedPosition.positionRank : parsedPosition.positionRank,
      tier: tierHeader ? toNumber(row[tierHeader]) ?? undefined : undefined,
      adp: adp ?? undefined,
      projectedPoints: projectedHeader ? toNumber(row[projectedHeader]) ?? undefined : undefined,
      byeWeek: byeHeader ? toNumber(row[byeHeader]) ?? undefined : undefined,
      notes: notesHeader ? cleanString(row[notesHeader]) || undefined : undefined,
      sourceMetadata: Object.keys(sourceMetadata).length > 0 ? sourceMetadata : undefined,
    });
  });

  players.sort((a, b) => a.overallRank - b.overallRank || a.name.localeCompare(b.name));
  if (players.length === 0) throw new Error('No valid ranking rows were found.');
  return { players, warnings, detectedSource };
}

export function deriveAdpFromEcrDifference(ecrRank: number, ecrVsAdp: number): number | undefined {
  const value = ecrRank + ecrVsAdp;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveHeader(headers: Map<string, string>, aliases: readonly string[]): string | undefined { for (const alias of aliases) { const actual = headers.get(normalizeHeader(alias)); if (actual) return actual; } return undefined; }
function normalizeHeader(value: string): string { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanString(value: unknown): string { return value == null ? '' : String(value).trim(); }
function parsePosition(value: string): { position: Position; positionRank?: number } | null {
  const normalized = value.trim().toUpperCase().replace(/\s/g, '');
  const defenseMatch = normalized.match(/^(?:DST|DEF|D\/ST|D-ST)(\d+)?$/);
  if (defenseMatch) return { position: 'DST', positionRank: defenseMatch[1] ? Number(defenseMatch[1]) : undefined };
  const match = normalized.match(/^(QB|RB|WR|TE|K)(\d+)?$/);
  if (!match) return null;
  const position = match[1] as Position;
  if (!VALID_POSITIONS.has(position)) return null;
  return { position, positionRank: match[2] ? Number(match[2]) : undefined };
}
function toNumber(value: unknown): number | null { if (value == null || value === '') return null; const normalized = String(value).replace(/[^0-9.+-]/g, ''); if (!normalized || normalized === '+' || normalized === '-' || normalized === '.') return null; const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : null; }
function parseFivePointRating(value: unknown): number | undefined { const text = cleanString(value); if (!text) return undefined; const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*out\s*of\s*5/i); if (!match) return undefined; const parsed = Number(match[1]); return Number.isFinite(parsed) ? parsed : undefined; }
function parsePercentOver(value: unknown): Pick<RankingSourceMetadata, 'percentOverConsensus' | 'percentOverCount' | 'percentOverTotal'> { const text = cleanString(value); if (!text) return {}; const match = text.match(/([0-9]+(?:\.[0-9]+)?)%\s*(?:\(([0-9]+)\s*\/\s*([0-9]+)\))?/); if (!match) return {}; return { percentOverConsensus: Number(match[1]), percentOverCount: match[2] ? Number(match[2]) : undefined, percentOverTotal: match[3] ? Number(match[3]) : undefined }; }
function detectSource(headers: Map<string, string>): string | undefined { return ['player name', 'tiers', 'ecr vs adp'].every((signal) => headers.has(normalizeHeader(signal))) ? 'FantasyPros' : undefined; }
function buildSourceMetadata(row: Record<string, unknown>, headers: Map<string, string>, detectedSource?: string): RankingSourceMetadata {
  const header = (field: keyof typeof HEADER_ALIASES) => resolveHeader(headers, HEADER_ALIASES[field]);
  const value = (field: keyof typeof HEADER_ALIASES) => { const resolved = header(field); return resolved ? row[resolved] : undefined; };
  const metadata: RankingSourceMetadata = {};
  if (detectedSource) metadata.provider = detectedSource;
  const upside = parseFivePointRating(value('upside')), bust = parseFivePointRating(value('bust')), sos = parseFivePointRating(value('strengthOfSchedule')), ecrVsAdp = toNumber(value('ecrVsAdp')), avg = toNumber(value('averageDifference'));
  if (upside != null) metadata.upsideRating = upside; if (bust != null) metadata.bustRating = bust; if (sos != null) metadata.strengthOfScheduleRating = sos; if (ecrVsAdp != null) metadata.ecrVsAdp = ecrVsAdp; if (avg != null) metadata.averageDifference = avg;
  Object.assign(metadata, parsePercentOver(value('percentOver'))); return metadata;
}
function identityKey(name: string, position: Position, nflTeam?: string): string { return [normalizeHeader(name), position.toLowerCase(), normalizeHeader(nflTeam ?? '')].join('|'); }
function stableId(name: string, position: Position, nflTeam?: string): string { const teamSuffix = nflTeam ? `-${normalizeHeader(nflTeam).replace(/\s/g, '-')}` : ''; return `${normalizeHeader(name).replace(/\s/g, '-')}-${position.toLowerCase()}${teamSuffix}`; }
