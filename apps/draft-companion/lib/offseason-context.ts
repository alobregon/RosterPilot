import journalData from '../data/offseason-context-2026.json';
import espnSupplementData from '../data/offseason-context-2026-espn.json';
import siSupplementData from '../data/offseason-context-2026-si.json';
import yahooPhillyVoiceSupplementData from '../data/offseason-context-2026-yahoo-phillyvoice.json';

export type OffseasonContextSourceStatus = 'INGESTED' | 'PENDING_EXCERPT';
export type OffseasonContextSubjectKind = 'PLAYER' | 'TEAM';
export type OffseasonContextEvidenceType = 'REPORTED_FACT' | 'ANALYST_OUTLOOK' | 'MIXED';
export type OffseasonContextDirection =
  | 'POSITIVE'
  | 'NEGATIVE'
  | 'MIXED'
  | 'MIXED_POSITIVE'
  | 'MIXED_NEGATIVE';
export type OffseasonContextConfidence = 'LOW_MEDIUM' | 'MEDIUM' | 'MEDIUM_HIGH' | 'HIGH';
export type OffseasonContextOutlookOrigin =
  | 'SOURCE_ANALYST'
  | 'SOURCE_CONSENSUS'
  | 'SOURCE_CONFLICT'
  | 'ROSTERPILOT_INFERENCE';

export interface OffseasonContextSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  status: OffseasonContextSourceStatus;
  notes?: string;
}

export interface OffseasonContextSubject {
  kind: OffseasonContextSubjectKind;
  name: string;
  team?: string;
}

export interface OffseasonContextFact {
  summary: string;
  sourceIds: string[];
}

export interface OffseasonContextOutlook {
  direction: OffseasonContextDirection;
  confidence: OffseasonContextConfidence;
  origin: OffseasonContextOutlookOrigin;
  summary: string;
}

export interface OffseasonContextEntry {
  id: string;
  subjects: OffseasonContextSubject[];
  categories: string[];
  evidenceType: OffseasonContextEvidenceType;
  facts: OffseasonContextFact[];
  outlook?: OffseasonContextOutlook;
  timeSensitive?: boolean;
  notes?: string;
}

export interface OffseasonContextJournal {
  season: number;
  version: number;
  updatedAt: string;
  purpose: string;
  rules: string[];
  sources: OffseasonContextSource[];
  entries: OffseasonContextEntry[];
}

interface OffseasonContextSupplement {
  season: number;
  version: number;
  updatedAt: string;
  sources: OffseasonContextSource[];
  entries: OffseasonContextEntry[];
}

const BASE_JOURNAL = journalData as unknown as OffseasonContextJournal;
const ESPN_SUPPLEMENT = espnSupplementData as unknown as OffseasonContextSupplement;
const SI_SUPPLEMENT = siSupplementData as unknown as OffseasonContextSupplement;
const YAHOO_PHILLYVOICE_SUPPLEMENT =
  yahooPhillyVoiceSupplementData as unknown as OffseasonContextSupplement;
const JOURNAL = mergeOffseasonContext(BASE_JOURNAL, [
  ESPN_SUPPLEMENT,
  YAHOO_PHILLYVOICE_SUPPLEMENT,
  SI_SUPPLEMENT,
]);

export function getOffseasonContextJournal(): OffseasonContextJournal {
  return JOURNAL;
}

export function getOffseasonContextSource(id: string): OffseasonContextSource | undefined {
  return JOURNAL.sources.find((source) => source.id === id);
}

export function getOffseasonContextForPlayers(
  playerNames: readonly string[],
  maxEntries = 20,
): OffseasonContextEntry[] {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error('maxEntries must be a positive integer.');
  }

  const wanted = new Set(playerNames.map(normalizeContextName).filter(Boolean));
  if (wanted.size === 0) return [];

  return JOURNAL.entries
    .filter((entry) =>
      entry.subjects.some(
        (subject) => subject.kind === 'PLAYER' && wanted.has(normalizeContextName(subject.name)),
      ),
    )
    .sort(compareContextEntries)
    .slice(0, maxEntries);
}

export function normalizeContextName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mergeOffseasonContext(
  base: OffseasonContextJournal,
  supplements: readonly OffseasonContextSupplement[],
): OffseasonContextJournal {
  const sources = new Map(base.sources.map((source) => [source.id, source]));
  const entries = new Map(base.entries.map((entry) => [entry.id, entry]));
  let version = base.version;
  let updatedAt = base.updatedAt;

  for (const supplement of supplements) {
    if (supplement.season !== base.season) {
      throw new Error(
        `Offseason context supplement season ${supplement.season} does not match base season ${base.season}.`,
      );
    }

    for (const source of supplement.sources) sources.set(source.id, source);
    for (const entry of supplement.entries) entries.set(entry.id, entry);
    version = Math.max(version, supplement.version);
    if (supplement.updatedAt > updatedAt) updatedAt = supplement.updatedAt;
  }

  return {
    ...base,
    version,
    updatedAt,
    sources: [...sources.values()],
    entries: [...entries.values()],
  };
}

function compareContextEntries(a: OffseasonContextEntry, b: OffseasonContextEntry): number {
  const timeSensitiveDifference = Number(Boolean(b.timeSensitive)) - Number(Boolean(a.timeSensitive));
  if (timeSensitiveDifference !== 0) return timeSensitiveDifference;

  const confidenceDifference = confidenceRank(b.outlook?.confidence) - confidenceRank(a.outlook?.confidence);
  if (confidenceDifference !== 0) return confidenceDifference;

  return a.id.localeCompare(b.id);
}

function confidenceRank(value: OffseasonContextConfidence | undefined): number {
  switch (value) {
    case 'HIGH':
      return 4;
    case 'MEDIUM_HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW_MEDIUM':
      return 1;
    default:
      return 0;
  }
}
