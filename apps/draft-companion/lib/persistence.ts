import { totalDraftPicks } from './board';
import { draftSlotForOverallPick, pickInRound, roundForOverallPick } from './draft';
import type { DraftConfig, DraftPick, PlayerRanking, RankingSourceMetadata } from './types';

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
  managerIds: string[];
  draftStarted: boolean;
}

export function serializeDraftSnapshot(args: {
  config: DraftConfig;
  players: PlayerRanking[];
  picks: DraftPick[];
  favoritePlayerIds?: string[];
  teamNames?: string[];
  managerIds?: string[];
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
    managerIds: Array.from({ length: args.config.teamCount }, (_, index) => args.managerIds?.[index] ?? ''),
    draftStarted: args.draftStarted ?? args.picks.length > 0,
  };
  return JSON.stringify(snapshot);
}

export function parseDraftSnapshot(raw: string): DraftSnapshot | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;
    if (value.version !== DRAFT_SNAPSHOT_VERSION) return null;
    if (typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) return null;
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
    if (picks.some((pick) => pick.overallPick > totalDraftPicks(config))) return null;
    if (picks.some((pick) => !hasCorrectSnakeMetadata(pick, config.teamCount))) return null;

    let favoritePlayerIds: string[] = [];
    if (value.favoritePlayerIds != null) {
      if (!Array.isArray(value.favoritePlayerIds) || !value.favoritePlayerIds.every((id) => typeof id === 'string')) return null;
      favoritePlayerIds = [...new Set(value.favoritePlayerIds.filter((id) => playerIds.has(id)))];
    }

    let teamNames: string[];
    if (value.teamNames != null) {
      if (!Array.isArray(value.teamNames) || !value.teamNames.every((name) => typeof name === 'string' && name.length <= 64)) return null;
      const savedNames = value.teamNames as string[];
      teamNames = Array.from({ length: config.teamCount }, (_, index) => savedNames[index] ?? '');
    } else {
      teamNames = Array.from({ length: config.teamCount }, () => '');
    }

    let managerIds: string[];
    if (value.managerIds != null) {
      if (!Array.isArray(value.managerIds) || !value.managerIds.every((id) => typeof id === 'string' && id.length <= 64)) return null;
      const savedManagerIds = value.managerIds as string[];
      managerIds = Array.from({ length: config.teamCount }, (_, index) => savedManagerIds[index] ?? '');
    } else {
      managerIds = Array.from({ length: config.teamCount }, () => '');
    }

    const normalizedConfig: DraftConfig = {
      ...config,
      teamNamesEnabled:
        config.teamNamesEnabled ??
        (config.opponentDetailsEnabled ?? teamNames.some((name) => name.trim().length > 0)),
      historicalManagersEnabled:
        config.historicalManagersEnabled ??
        (config.opponentDetailsEnabled ?? managerIds.some((id) => id.length > 0)),
    };

    if (value.draftStarted != null && typeof value.draftStarted !== 'boolean') return null;
    const draftStarted = typeof value.draftStarted === 'boolean' ? value.draftStarted : picks.length > 0;
    if (!draftStarted && picks.length > 0) return null;

    return {
      version: value.version,
      savedAt: value.savedAt,
      config: normalizedConfig,
      players,
      picks: [...picks].sort((a, b) => a.overallPick - b.overallPick),
      favoritePlayerIds,
      teamNames,
      managerIds,
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
    isIntegerInRange(value.teamCount, 4, 20) &&
    isPositiveInteger(value.userDraftSlot) &&
    value.userDraftSlot <= value.teamCount &&
    (value.scoringFormat === 'STANDARD' || value.scoringFormat === 'HALF_PPR' || value.scoringFormat === 'PPR') &&
    isIntegerInRange(value.qbStarters, 0, 10) &&
    isIntegerInRange(value.rbStarters, 0, 10) &&
    isIntegerInRange(value.wrStarters, 0, 10) &&
    isIntegerInRange(value.teStarters, 0, 10) &&
    isIntegerInRange(value.flexStarters, 0, 10) &&
    isIntegerInRange(value.dstStarters, 0, 10) &&
    isIntegerInRange(value.kStarters, 0, 10) &&
    isIntegerInRange(value.benchSpots, 0, 20) &&
    (value.draftStrategy == null || ['BALANCED', 'HERO_RB', 'ZERO_RB', 'ROBUST_RB', 'WR_HEAVY', 'LATE_QB', 'ELITE_TE', 'UPSIDE_HEAVY'].includes(String(value.draftStrategy))) &&
    (value.opponentDetailsEnabled == null || typeof value.opponentDetailsEnabled === 'boolean') &&
    (value.teamNamesEnabled == null || typeof value.teamNamesEnabled === 'boolean') &&
    (value.historicalManagersEnabled == null || typeof value.historicalManagersEnabled === 'boolean') &&
    (value.draftMode == null || value.draftMode === 'LIVE' || value.draftMode === 'SIMULATOR') &&
    (value.simulationRoomProfile == null || ['RANK_ORDER', 'RB_RUSH', 'WR_RUSH', 'QB_RUSH', 'TE_RUSH', 'DST_EARLY'].includes(String(value.simulationRoomProfile))) &&
    (value.simulationPace == null || value.simulationPace === 'INSTANT' || value.simulationPace === 'WATCH')
  );
}

function isPlayerRanking(value: unknown): value is PlayerRanking {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' || value.id.length === 0 ||
    typeof value.name !== 'string' || value.name.length === 0 ||
    !['QB', 'RB', 'WR', 'TE', 'K', 'DST'].includes(String(value.position)) ||
    !isFiniteNumber(value.overallRank)
  ) return false;
  if (value.nflTeam != null && typeof value.nflTeam !== 'string') return false;
  if (!optionalFiniteNumber(value.positionRank) || !optionalFiniteNumber(value.tier) || !optionalFiniteNumber(value.adp) || !optionalFiniteNumber(value.projectedPoints) || !optionalFiniteNumber(value.byeWeek)) return false;
  if (value.notes != null && typeof value.notes !== 'string') return false;
  if (value.sourceMetadata != null && !isRankingSourceMetadata(value.sourceMetadata)) return false;
  return true;
}

function isRankingSourceMetadata(value: unknown): value is RankingSourceMetadata {
  if (!isRecord(value)) return false;
  if (value.provider != null && typeof value.provider !== 'string') return false;
  for (const key of ['upsideRating', 'bustRating', 'strengthOfScheduleRating', 'ecrVsAdp', 'averageDifference', 'percentOverConsensus', 'percentOverCount', 'percentOverTotal']) {
    if (!optionalFiniteNumber(value[key])) return false;
  }
  if (value.adpSource != null && value.adpSource !== 'EXPLICIT' && value.adpSource !== 'DERIVED_ECR_VS_ADP') return false;
  return true;
}

function isDraftPick(value: unknown): value is DraftPick {
  if (!isRecord(value)) return false;
  return isPositiveInteger(value.overallPick) && isPositiveInteger(value.round) && isPositiveInteger(value.pickInRound) && isPositiveInteger(value.draftSlot) && typeof value.playerId === 'string' && value.playerId.length > 0;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isPositiveInteger(value: unknown): value is number { return typeof value === 'number' && Number.isInteger(value) && value > 0; }
function isIntegerInRange(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max; }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function optionalFiniteNumber(value: unknown): boolean { return value == null || isFiniteNumber(value); }
