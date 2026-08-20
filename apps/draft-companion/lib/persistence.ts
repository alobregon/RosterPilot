import { draftSlotForOverallPick, pickInRound, roundForOverallPick } from './draft';
import type { DraftConfig, DraftPick, PlayerRanking } from './types';

export const DRAFT_SNAPSHOT_VERSION = 1;
export const DRAFT_STORAGE_KEY = 'rosterpilot:draft-companion:v1';

export interface DraftSnapshot {
  version: number;
  savedAt: string;
  config: DraftConfig;
  players: PlayerRanking[];
  picks: DraftPick[];
  favoritePlayerIds: string[];
  teamNames: string[];
  draftStarted: boolean;
}

export function serializeDraftSnapshot(args: {
  config: DraftConfig;
  players: PlayerRanking[];
  picks: DraftPick[];
  favoritePlayerIds?: string[];
  teamNames?: string[];
  draftStarted?: boolean;
  savedAt?: Date;
}): string {
  const snapshot: DraftSnapshot = {
    version: DRAFT_SNAPSHOT_VERSION,
    savedAt: (args.savedAt ?? new Date()).toISOString(),
    config: args.config,
    players: args.players,
    picks: args.picks,
    favoritePlayerIds: [...new Set(args.favoritePlayerIds ?? [])],
    teamNames: Array.from({ length: args.config.teamCount }, (_, index) => args.teamNames?.[index] ?? ''),
    draftStarted: args.draftStarted ?? args.picks.length > 0,
  };
  return JSON.stringify(snapshot);
}

export function parseDraftSnapshot(raw: string): DraftSnapshot | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;
    if (value.version !== DRAFT_SNAPSHOT_VERSION) return null;
    if (typeof value.savedAt !== 'string') return null;
    if (!isDraftConfig(value.config)) return null;
    const config = value.config;
    if (!Array.isArray(value.players) || !value.players.every(isPlayerRanking)) return null;
    if (!Array.isArray(value.picks) || !value.picks.every(isDraftPick)) return null;

    const players = value.players as PlayerRanking[];
    const picks = value.picks as DraftPick[];
    const playerIds = new Set(players.map((player) => player.id));
    if (playerIds.size !== players.length) return null;
    if (picks.some((pick) => !playerIds.has(pick.playerId))) return null;
    if (new Set(picks.map((pick) => pick.overallPick)).size !== picks.length) return null;
    if (new Set(picks.map((pick) => pick.playerId)).size !== picks.length) return null;
    if (picks.some((pick) => !hasCorrectSnakeMetadata(pick, config.teamCount))) return null;

    let favoritePlayerIds: string[] = [];
    if (value.favoritePlayerIds != null) {
      if (!Array.isArray(value.favoritePlayerIds) || !value.favoritePlayerIds.every((id) => typeof id === 'string')) return null;
      favoritePlayerIds = [...new Set(value.favoritePlayerIds.filter((id) => playerIds.has(id)))];
    }

    let teamNames: string[];
    if (value.teamNames != null) {
      if (!Array.isArray(value.teamNames) || !value.teamNames.every((name) => typeof name === 'string')) return null;
      const savedNames = value.teamNames as string[];
      teamNames = Array.from({ length: config.teamCount }, (_, index) => savedNames[index] ?? '');
    } else {
      teamNames = Array.from({ length: config.teamCount }, () => '');
    }

    if (value.draftStarted != null && typeof value.draftStarted !== 'boolean') return null;
    const draftStarted = typeof value.draftStarted === 'boolean' ? value.draftStarted : picks.length > 0;
    if (!draftStarted && picks.length > 0) return null;

    return {
      version: value.version,
      savedAt: value.savedAt,
      config,
      players,
      picks: [...picks].sort((a, b) => a.overallPick - b.overallPick),
      favoritePlayerIds,
      teamNames,
      draftStarted,
    };
  } catch {
    return null;
  }
}

function hasCorrectSnakeMetadata(pick: DraftPick, teamCount: number): boolean {
  return (
    pick.round === roundForOverallPick(pick.overallPick, teamCount) &&
    pick.pickInRound === pickInRound(pick.overallPick, teamCount) &&
    pick.draftSlot === draftSlotForOverallPick(pick.overallPick, teamCount)
  );
}

function isDraftConfig(value: unknown): value is DraftConfig {
  if (!isRecord(value)) return false;
  return (
    isPositiveInteger(value.teamCount) &&
    isPositiveInteger(value.userDraftSlot) &&
    value.userDraftSlot <= value.teamCount &&
    (value.scoringFormat === 'STANDARD' || value.scoringFormat === 'HALF_PPR' || value.scoringFormat === 'PPR') &&
    isNonNegativeInteger(value.qbStarters) &&
    isNonNegativeInteger(value.rbStarters) &&
    isNonNegativeInteger(value.wrStarters) &&
    isNonNegativeInteger(value.teStarters) &&
    isNonNegativeInteger(value.flexStarters) &&
    isNonNegativeInteger(value.dstStarters) &&
    isNonNegativeInteger(value.kStarters) &&
    isNonNegativeInteger(value.benchSpots) &&
    (value.draftStrategy == null || ['BALANCED', 'HERO_RB', 'ZERO_RB', 'ROBUST_RB', 'WR_HEAVY', 'LATE_QB', 'ELITE_TE', 'UPSIDE_HEAVY'].includes(String(value.draftStrategy)))
  );
}

function isPlayerRanking(value: unknown): value is PlayerRanking {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 && typeof value.name === 'string' && value.name.length > 0 && ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].includes(String(value.position)) && typeof value.overallRank === 'number' && Number.isFinite(value.overallRank);
}
function isDraftPick(value: unknown): value is DraftPick {
  if (!isRecord(value)) return false;
  return isPositiveInteger(value.overallPick) && isPositiveInteger(value.round) && isPositiveInteger(value.pickInRound) && isPositiveInteger(value.draftSlot) && typeof value.playerId === 'string' && value.playerId.length > 0;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isPositiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value > 0; }
function isNonNegativeInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= 0; }
