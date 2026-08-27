import managerProfilesData from '../../../research/league_manager_profiles_2013_2025.json';
import { draftPickAtOverall } from './corrections';
import { draftSlotForOverallPick } from './draft';
import { recommendPlayers } from './recommendation';
import type {
  DraftConfig,
  DraftPick,
  PlayerRanking,
  Position,
  Recommendation,
  SimulationRoomProfile,
} from './types';

export type RoomProfile = SimulationRoomProfile;

type HistoricalPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
type DraftPhase = 'R1_4' | 'R5_8' | 'R9_12' | 'R13_16';

interface SimulatorManagerProfile {
  manager_id: string;
  draft_count: number;
  phase_position_probabilities_recency_weighted: Record<DraftPhase, Record<HistoricalPosition, number>>;
}

const historicalProfiles = managerProfilesData.profiles as unknown as SimulatorManagerProfile[];
const HISTORICAL_CANDIDATE_WINDOW = 12;
const MARKET_SLOT_PENALTY = 3;
const ROSTER_NEED_WEIGHT = 0.09;
const HISTORY_WEIGHT = 1.05;
const ROOM_PROFILE_BONUS = 10;
const MAX_MANAGER_POSITION_BIAS = 8;
const JITTER_AMPLITUDE = 1.5;

export interface DraftSimulationResult {
  picks: DraftPick[];
  userPlayerIds: string[];
  completed: boolean;
}

export interface RecommendationSnapshot {
  overallPick: number;
  recommendations: Recommendation[];
}

export interface DeterministicDraftSimulationResult extends DraftSimulationResult {
  userCounts: Record<Position, number>;
  userRecommendations: RecommendationSnapshot[];
}

/**
 * Adds exactly one simulated opponent pick. If the supplied pick belongs to
 * the user, the draft is returned unchanged so the interactive UI can stop
 * and let the user make the decision.
 *
 * When a historical manager ID is supplied for the slot, the simulator keeps
 * current rankings/ADP dominant but allows roster need and the manager's
 * recency-weighted positional tendencies to break close calls. The historical
 * path is restricted to the top 12 current market candidates so old behavior
 * cannot manufacture extreme reaches.
 */
export function simulateNextOpponentPick(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  roomProfile?: SimulationRoomProfile;
  managerIds?: readonly string[];
}): DraftPick[] {
  const { players, picks, config, currentOverallPick } = args;
  const slot = draftSlotForOverallPick(currentOverallPick, config.teamCount);
  if (slot === config.userDraftSlot) return picks;
  if (currentOverallPick > config.teamCount * totalRosterSlots(config)) return picks;

  const drafted = new Set(picks.map((pick) => pick.playerId));
  const available = players.filter((player) => !drafted.has(player.id));
  if (!available.length) return picks;

  const selected = chooseOpponentPlayer({
    available,
    roomProfile: args.roomProfile ?? config.simulationRoomProfile ?? 'RANK_ORDER',
    overallPick: currentOverallPick,
    config,
    roster: rosterForSlot(slot, picks, players),
    managerId: args.managerIds?.[slot - 1],
  });
  return [...picks, draftPickAtOverall(currentOverallPick, selected.id, config.teamCount)]
    .sort((a, b) => a.overallPick - b.overallPick);
}

/**
 * Fills simulated opponent selections until the user's next pick. This is the
 * fast path used by interactive Simulator mode. It never auto-selects a user
 * player.
 */
export function autoDraftOpponentsUntilUserTurn(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  roomProfile?: SimulationRoomProfile;
  managerIds?: readonly string[];
}): DraftPick[] {
  let next = [...args.picks].sort((a, b) => a.overallPick - b.overallPick);
  let overallPick = args.currentOverallPick;
  const total = args.config.teamCount * totalRosterSlots(args.config);

  while (
    overallPick <= total &&
    draftSlotForOverallPick(overallPick, args.config.teamCount) !== args.config.userDraftSlot
  ) {
    const updated = simulateNextOpponentPick({
      ...args,
      picks: next,
      currentOverallPick: overallPick,
    });
    if (updated.length === next.length) break;
    next = updated;
    overallPick += 1;
  }

  return next;
}

export function simulateDraft(args: {
  players: PlayerRanking[];
  config: DraftConfig;
  favoritePlayerIds?: readonly string[];
  roomProfile?: RoomProfile;
  managerIds?: readonly string[];
}): DraftSimulationResult {
  const { players, config, favoritePlayerIds = [], roomProfile = 'RANK_ORDER', managerIds = [] } = args;
  const rosterSlots = totalRosterSlots(config);
  const total = config.teamCount * rosterSlots;
  const picks: DraftPick[] = [];
  const drafted = new Set<string>();
  const userPlayerIds: string[] = [];

  for (let overallPick = 1; overallPick <= total; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    const available = players.filter((player) => !drafted.has(player.id));
    if (available.length === 0) break;

    let selected: PlayerRanking | undefined;
    if (slot === config.userDraftSlot) {
      selected = recommendPlayers({ players, picks, config, currentOverallPick: overallPick, favoritePlayerIds, limit: 1 })[0]?.player;
    } else {
      selected = chooseOpponentPlayer({
        available,
        roomProfile,
        overallPick,
        config,
        roster: rosterForSlot(slot, picks, players),
        managerId: managerIds[slot - 1],
      });
    }
    if (!selected) break;
    drafted.add(selected.id);
    picks.push(draftPickAtOverall(overallPick, selected.id, config.teamCount));
    if (slot === config.userDraftSlot) userPlayerIds.push(selected.id);
  }

  return { picks, userPlayerIds, completed: picks.length === total };
}

/**
 * Deterministic rank-order simulation used by the release test harness.
 * Opponents always take the highest-ranked available player while the user
 * follows the same recommendation engine that powers the live draft UI.
 * Every on-clock recommendation set is captured so tests can validate the
 * recommendation-percent contract across a complete draft lifecycle.
 */
export function simulateDeterministicDraft(args: {
  players: PlayerRanking[];
  config: DraftConfig;
  favoritePlayerIds?: readonly string[];
}): DeterministicDraftSimulationResult {
  const { players, config, favoritePlayerIds = [] } = args;
  const total = config.teamCount * totalRosterSlots(config);
  const picks: DraftPick[] = [];
  const drafted = new Set<string>();
  const userPlayerIds: string[] = [];
  const userRecommendations: RecommendationSnapshot[] = [];
  const playerById = new Map(players.map((player) => [player.id, player]));

  for (let overallPick = 1; overallPick <= total; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    const available = players.filter((player) => !drafted.has(player.id));
    if (available.length === 0) break;

    let selected: PlayerRanking | undefined;
    if (slot === config.userDraftSlot) {
      const recommendations = recommendPlayers({
        players,
        picks,
        config,
        currentOverallPick: overallPick,
        favoritePlayerIds,
        limit: 3,
      });
      userRecommendations.push({ overallPick, recommendations });
      selected = recommendations[0]?.player;
    } else {
      selected = [...available].sort((a, b) => a.overallRank - b.overallRank)[0];
    }

    if (!selected) break;
    drafted.add(selected.id);
    picks.push(draftPickAtOverall(overallPick, selected.id, config.teamCount));
    if (slot === config.userDraftSlot) userPlayerIds.push(selected.id);
  }

  const userCounts = emptyPositionCounts();
  for (const playerId of userPlayerIds) {
    const player = playerById.get(playerId);
    if (player) userCounts[player.position] += 1;
  }

  return {
    picks,
    userPlayerIds,
    userCounts,
    userRecommendations,
    completed: picks.length === total,
  };
}

/**
 * Checks whether a completed roster can fill every configured starting slot.
 * FLEX is satisfied by the aggregate RB/WR/TE pool after their fixed starter
 * requirements are met.
 */
export function hasLegalStartingRoster(counts: Record<Position, number>, config: DraftConfig): boolean {
  if (counts.QB < config.qbStarters) return false;
  if (counts.RB < config.rbStarters) return false;
  if (counts.WR < config.wrStarters) return false;
  if (counts.TE < config.teStarters) return false;
  if (counts.DST < config.dstStarters) return false;
  if (counts.K < config.kStarters) return false;

  const skillPlayers = counts.RB + counts.WR + counts.TE;
  const requiredSkillPlayers = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  return skillPlayers >= requiredSkillPlayers;
}

function chooseOpponentPlayer(args: {
  available: PlayerRanking[];
  roomProfile: RoomProfile;
  overallPick: number;
  config: DraftConfig;
  roster: PlayerRanking[];
  managerId?: string;
}): PlayerRanking {
  const { available, roomProfile, overallPick, config, roster, managerId } = args;
  const round = Math.floor((overallPick - 1) / config.teamCount) + 1;
  const preferred = preferredPosition(roomProfile, round);
  const ranked = [...available].sort(marketOrderCompare);

  // Preserve the simple QA room behavior when manager history is not enabled.
  if (!managerId) {
    if (!preferred) return ranked[0];
    const positional = ranked.filter((player) => player.position === preferred);
    return positional[0] ?? ranked[0];
  }

  const candidates = ranked.slice(0, HISTORICAL_CANDIDATE_WINDOW);
  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < candidates.length; index += 1) {
    const player = candidates[index];
    const marketScore = 100 - index * MARKET_SLOT_PENALTY;
    const rosterNeed = opponentRosterNeedScore(player.position, roster, config, round) * ROSTER_NEED_WEIGHT;
    const historyBias = managerPositionBias(managerId, player.position, round) * HISTORY_WEIGHT;
    const roomBias = preferred === player.position ? ROOM_PROFILE_BONUS : 0;
    const jitter = deterministicJitter(`${managerId}|${overallPick}|${player.id}`) * JITTER_AMPLITUDE;
    const score = marketScore + rosterNeed + historyBias + roomBias + jitter;

    if (score > bestScore) {
      best = player;
      bestScore = score;
    }
  }

  return best;
}

function marketOrderCompare(a: PlayerRanking, b: PlayerRanking): number {
  return marketOrderValue(a) - marketOrderValue(b) || a.overallRank - b.overallRank || a.name.localeCompare(b.name);
}

function marketOrderValue(player: PlayerRanking): number {
  const adp = player.adp ?? player.overallRank;
  return player.overallRank * 0.7 + adp * 0.3;
}

function managerPositionBias(managerId: string, position: Position, round: number): number {
  const profile = historicalProfiles.find((candidate) => candidate.manager_id === managerId);
  if (!profile) return 0;
  const phase = phaseForRound(round);
  const historicalPosition = position === 'DST' ? 'DEF' : position;
  const managerProbability = profile.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition] ?? 0;
  const leagueValues = historicalProfiles
    .map((candidate) => candidate.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const leagueProbability = leagueValues.length
    ? leagueValues.reduce((sum, value) => sum + value, 0) / leagueValues.length
    : 0;
  const confidence = clamp(profile.draft_count / 10, 0.35, 1);
  return clamp((managerProbability - leagueProbability) * 70 * confidence, -MAX_MANAGER_POSITION_BIAS, MAX_MANAGER_POSITION_BIAS);
}

function opponentRosterNeedScore(position: Position, roster: PlayerRanking[], config: DraftConfig, round: number): number {
  const counts = positionCounts(roster);

  if (position === 'QB') {
    return counts.QB < config.qbStarters ? 65 : counts.QB === config.qbStarters ? 12 : 2;
  }
  if (position === 'DST') {
    if (counts.DST >= config.dstStarters) return 2;
    if (round < 8) return 1;
    if (round <= 10) return 45;
    return 80;
  }
  if (position === 'K') {
    if (counts.K >= config.kStarters) return 2;
    if (round < 12) return 1;
    if (round <= 13) return 45;
    return 85;
  }

  const starterTarget = position === 'RB' ? config.rbStarters : position === 'WR' ? config.wrStarters : config.teStarters;
  if (counts[position] < starterTarget) return position === 'TE' ? 72 : 100;

  const flexEligible = counts.RB + counts.WR + counts.TE;
  const flexTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  const baseDeficit = Math.max(0, config.rbStarters - counts.RB)
    + Math.max(0, config.wrStarters - counts.WR)
    + Math.max(0, config.teStarters - counts.TE);
  if (baseDeficit === 0 && flexEligible < flexTarget) {
    return position === 'TE' ? 68 : position === 'WR' ? 84 : 82;
  }

  const depth = Math.max(0, counts[position] - starterTarget);
  if (position === 'WR') return depth === 0 ? 60 : depth === 1 ? 46 : depth === 2 ? 32 : 15;
  if (position === 'RB') return depth === 0 ? 56 : depth === 1 ? 42 : depth === 2 ? 28 : 12;
  return depth === 0 ? 24 : 8;
}

function positionCounts(roster: PlayerRanking[]): Record<Position, number> {
  return roster.reduce<Record<Position, number>>((counts, player) => {
    counts[player.position] += 1;
    return counts;
  }, emptyPositionCounts());
}

function rosterForSlot(draftSlot: number, picks: DraftPick[], players: PlayerRanking[]): PlayerRanking[] {
  const playerById = new Map(players.map((player) => [player.id, player]));
  return picks
    .filter((pick) => pick.draftSlot === draftSlot)
    .sort((a, b) => a.overallPick - b.overallPick)
    .map((pick) => playerById.get(pick.playerId))
    .filter((player): player is PlayerRanking => Boolean(player));
}

function preferredPosition(profile: RoomProfile, round: number): Position | null {
  if (profile === 'RB_RUSH' && round <= 4) return 'RB';
  if (profile === 'WR_RUSH' && round <= 4) return 'WR';
  if (profile === 'QB_RUSH' && round <= 3) return 'QB';
  if (profile === 'TE_RUSH' && round <= 4) return 'TE';
  if (profile === 'DST_EARLY' && round >= 8 && round <= 10) return 'DST';
  return null;
}

function phaseForRound(round: number): DraftPhase {
  if (round <= 4) return 'R1_4';
  if (round <= 8) return 'R5_8';
  if (round <= 12) return 'R9_12';
  return 'R13_16';
}

function deterministicJitter(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

function totalRosterSlots(config: DraftConfig): number {
  return config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters + config.dstStarters + config.kStarters + config.benchSpots;
}

function emptyPositionCounts(): Record<Position, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
