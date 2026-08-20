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
    if (!Array.isArray(value.players) || !value.players.every(isPlayerRanking)) return null;
    if (!Array.isArray(value.picks) || !value.picks.every(isDraftPick)) return null;

    const playerIds = new Set(value.players.map((player) => player.id));
    if (value.picks.some((pick) => !playerIds.has(pick.playerId))) return null;

    let favoritePlayerIds: string[] = [];
    if (value.favoritePlayerIds != null) {
      if (!Array.isArray(value.favoritePlayerIds) || !value.favoritePlayerIds.every((id) => typeof id === 'string')) {
        return null;
      }
      favoritePlayerIds = [...new Set(value.favoritePlayerIds.filter((id) => playerIds.has(id)))];
    }

    let teamNames: string[] = [];
    if (value.teamNames != null) {
      if (!Array.isArray(value.teamNames) || !value.teamNames.every((name) => typeof name === 'string')) return null;
      const savedTeamNames = value.teamNames as string[];
      teamNames = Array.from({ length: value.config.teamCount }, (_, index) => savedTeamNames[index] ?? '');
    } else {
      teamNames = Array.from({ length: value.config.teamCount }, () => '');
    }

    const draftStarted =
      typeof value.draftStarted === 'boolean' ? value.draftStarted : value.picks.length > 0;

    return {
      version: value.version,
      savedAt: value.savedAt,
      config: value.config,
      players: value.players,
      picks: value.picks,
      favoritePlayerIds,
      teamNames,
      draftStarted,
    } as DraftSnapshot;
  } catch {
    return null;
  }
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
    (value.draftStrategy == null ||
      ['BALANCED', 'HERO_RB', 'ZERO_RB', 'ROBUST_RB', 'WR_HEAVY', 'LATE_QB', 'ELITE_TE', 'UPSIDE_HEAVY'].includes(
        String(value.draftStrategy),
      ))
  );
}

function isPlayerRanking(value: unknown): value is PlayerRanking {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].includes(String(value.position)) &&
    typeof value.overallRank === 'number' &&
    Number.isFinite(value.overallRank)
  );
}

function isDraftPick(value: unknown): value is DraftPick {
  if (!isRecord(value)) return false;
  return (
    isPositiveInteger(value.overallPick) &&
    isPositiveInteger(value.round) &&
    isPositiveInteger(value.pickInRound) &&
    isPositiveInteger(value.draftSlot) &&
    typeof value.playerId === 'string' &&
    value.playerId.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
