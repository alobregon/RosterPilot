import managerProfilesData from '../../../research/league_manager_profiles_2013_2025.json';
import round1ProfilesData from '../../../research/league_manager_round1_profiles_2013_2025.json';
import sequenceProfilesData from '../../../research/league_manager_sequence_profiles_2013_2025.json';
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
type SequenceStat = [number, number, Partial<Record<HistoricalPosition, number>>];
type RepeatStat = [number, number, number];

interface SimulatorManagerProfile {
  manager_id: string;
  draft_count: number;
  phase_position_probabilities_recency_weighted: Record<DraftPhase, Record<HistoricalPosition, number>>;
  average_final_roster: Record<HistoricalPosition, number>;
}

interface SimulatorRound1Profile {
  manager_id: string;
  draft_count: number;
  round1_position_probabilities_recency_weighted: Record<HistoricalPosition, number>;
}

interface SimulatorSequenceProfile {
  manager_id: string;
  draft_count: number;
  early_prefix_next: Record<string, SequenceStat>;
  repeat_rounds2_8: RepeatStat;
  extend_two_same_rounds3_8: RepeatStat;
}

export interface SimulationTolerance {
  candidateWindow: number;
  marketSlotPenalty: number;
  maxManagerPositionBias: number;
  jitterAmplitude: number;
}

const historicalProfiles = managerProfilesData.profiles as unknown as SimulatorManagerProfile[];
const round1Profiles = round1ProfilesData.profiles as unknown as SimulatorRound1Profile[];
const sequenceProfiles = sequenceProfilesData.profiles as unknown as SimulatorSequenceProfile[];
const ROSTER_NEED_WEIGHT = 0.09;
const HISTORY_WEIGHT = 1.05;
const ROOM_PROFILE_BONUS = 10;
const MAX_MANAGER_ROSTER_CONSTRUCTION_BIAS = 4;
const MANAGER_ROSTER_PACE_WEIGHT = 1.4;
const MANAGER_ROSTER_SHARE_WEIGHT = 18;
const DEFAULT_SIMULATION_SEED = 'rosterpilot-default-simulation';
const REPEAT_PRIOR_WEIGHT = 6;
const STREAK_PRIOR_WEIGHT = 4;
const EARLY_PREFIX_PRIOR_WEIGHT = 3;

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
 * Ranking confidence is intentionally strongest at the top of the draft and
 * relaxes as the market becomes flatter and individual roster construction
 * becomes more important. The candidate window, history cap, market-slot
 * penalty, and seeded variation therefore widen together by draft phase.
 */
export function simulationToleranceForRound(round: number): SimulationTolerance {
  const normalizedRound = Math.max(1, Math.trunc(round));
  if (normalizedRound === 1) {
    return {
      candidateWindow: 10,
      marketSlotPenalty: 3,
      maxManagerPositionBias: 3,
      jitterAmplitude: 1.5,
    };
  }
  if (normalizedRound <= 4) {
    return {
      candidateWindow: 12,
      marketSlotPenalty: 2.5,
      maxManagerPositionBias: 5,
      jitterAmplitude: 1.5,
    };
  }
  if (normalizedRound <= 8) {
    return {
      candidateWindow: 16,
      marketSlotPenalty: 1.75,
      maxManagerPositionBias: 7,
      jitterAmplitude: 2,
    };
  }
  if (normalizedRound <= 12) {
    return {
      candidateWindow: 20,
      marketSlotPenalty: 1.25,
      maxManagerPositionBias: 9,
      jitterAmplitude: 2.5,
    };
  }
  return {
    candidateWindow: 24,
    marketSlotPenalty: 0.9,
    maxManagerPositionBias: 10,
    jitterAmplitude: 3,
  };
}

/**
 * Adds exactly one simulated opponent pick. If the supplied pick belongs to
 * the user, the draft is returned unchanged so the interactive UI can stop
 * and let the user make the decision.
 *
 * When a historical manager ID is supplied for the slot, the simulator keeps
 * current rankings/ADP dominant but allows generic roster need, the manager's
 * recency-weighted sequence tendencies, historical roster construction, and
 * small run-seeded variation to break close calls. Market tolerance expands
 * by round because rankings/ADP become less precise deeper in the draft.
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

/**
 * Returns the recency-weighted effective historical probability for a manager
 * selecting a position after the supplied prior position sequence.
 *
 * Round 1 uses a dedicated recency-weighted first-pick distribution. From
 * Round 2 onward the model backs off hierarchically:
 *   phase tendency -> same-position repeat behavior -> two-pick streak behavior
 *   -> exact first-four prefix when that prefix has historical observations.
 *
 * Every conditional layer is shrunk toward the broader layer beneath it, so a
 * one-season pattern cannot overpower the current market.
 */
export function historicalSequencePositionProbability(args: {
  managerId: string;
  position: Position;
  round: number;
  priorPositions: readonly Position[];
}): number | null {
  const profile = historicalProfiles.find((candidate) => candidate.manager_id === args.managerId);
  if (!profile) return null;

  const phase = phaseForRound(args.round);
  const round1Profile = args.round === 1
    ? round1Profiles.find((candidate) => candidate.manager_id === args.managerId)
    : undefined;
  const base = normalizeDistribution(
    round1Profile?.round1_position_probabilities_recency_weighted
      ?? profile.phase_position_probabilities_recency_weighted[phase],
  );
  const sequenceProfile = sequenceProfiles.find((candidate) => candidate.manager_id === args.managerId);
  if (!sequenceProfile || !args.priorPositions.length) {
    return base[historyPosition(args.position)];
  }

  let distribution = { ...base };
  const priorHistory = args.priorPositions.map(historyPosition);
  const lastPosition = priorHistory[priorHistory.length - 1];

  if (args.round >= 2 && args.round <= 8) {
    distribution = conditionOnRepeat(
      distribution,
      lastPosition,
      sequenceProfile.repeat_rounds2_8,
      REPEAT_PRIOR_WEIGHT,
    );

    if (
      priorHistory.length >= 2 &&
      priorHistory[priorHistory.length - 2] === lastPosition
    ) {
      distribution = conditionOnRepeat(
        distribution,
        lastPosition,
        sequenceProfile.extend_two_same_rounds3_8,
        STREAK_PRIOR_WEIGHT,
      );
    }
  }

  if (args.round >= 2 && args.round <= 4) {
    const prefix = priorHistory.slice(0, args.round - 1).join('>');
    const prefixStat = sequenceProfile.early_prefix_next[prefix];
    if (prefixStat) {
      distribution = posteriorDistribution(prefixStat, distribution, EARLY_PREFIX_PRIOR_WEIGHT);
    }
  }

  return distribution[historyPosition(args.position)];
}

/**
 * Returns a bounded manager-specific roster-construction score derived from
 * that manager's historical average final roster. The score is intentionally
 * small: generic starter/FLEX need remains authoritative, while this layer
 * nudges close depth decisions toward the roster shape the manager usually
 * builds.
 *
 * The historical target is treated as a position share rather than an exact
 * count so it still behaves sensibly if the current league uses a different
 * total roster size. The pace component compares the roster currently built
 * with the manager's historical share of picks, and grows modestly as the
 * draft progresses. A small league-relative share term preserves differences
 * between managers even before much roster history has accumulated.
 */
export function historicalRosterConstructionBias(args: {
  managerId: string;
  position: Position;
  roster: readonly PlayerRanking[];
  config: DraftConfig;
}): number | null {
  const profile = historicalProfiles.find((candidate) => candidate.manager_id === args.managerId);
  if (!profile) return null;

  const historicalPosition = historyPosition(args.position);
  const managerTotal = historicalRosterTotal(profile);
  if (managerTotal <= 0) return 0;

  const managerShare = (profile.average_final_roster[historicalPosition] ?? 0) / managerTotal;
  const leagueShares = historicalProfiles
    .map((candidate) => {
      const total = historicalRosterTotal(candidate);
      return total > 0 ? (candidate.average_final_roster[historicalPosition] ?? 0) / total : null;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));
  const leagueShare = leagueShares.length
    ? leagueShares.reduce((sum, value) => sum + value, 0) / leagueShares.length
    : managerShare;

  const counts = positionCounts(args.roster);
  const picksMade = args.roster.length;
  const currentCount = counts[args.position];
  const expectedCount = managerShare * picksMade;
  const paceGap = expectedCount - currentCount;
  const progress = clamp(picksMade / Math.max(1, totalRosterSlots(args.config)), 0, 1);
  const paceMultiplier = 0.6 + progress * 0.9;
  const sharePressure = (managerShare - leagueShare)
    * MANAGER_ROSTER_SHARE_WEIGHT
    * (0.25 + progress * 0.75);
  const confidence = clamp(profile.draft_count / 10, 0.35, 1);

  return clamp(
    (paceGap * MANAGER_ROSTER_PACE_WEIGHT * paceMultiplier + sharePressure) * confidence,
    -MAX_MANAGER_ROSTER_CONSTRUCTION_BIAS,
    MAX_MANAGER_ROSTER_CONSTRUCTION_BIAS,
  );
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

  const tolerance = simulationToleranceForRound(round);
  const candidates = ranked.slice(0, tolerance.candidateWindow);
  let best = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  const simulationSeed = config.simulationSeed ?? DEFAULT_SIMULATION_SEED;

  for (let index = 0; index < candidates.length; index += 1) {
    const player = candidates[index];
    const marketScore = 100 - index * tolerance.marketSlotPenalty;
    const rosterNeed = opponentRosterNeedScore(player.position, roster, config, round) * ROSTER_NEED_WEIGHT;
    const historyBias = managerPositionBias(managerId, player.position, round, roster) * HISTORY_WEIGHT;
    const rosterConstructionBias = historicalRosterConstructionBias({
      managerId,
      position: player.position,
      roster,
      config,
    }) ?? 0;
    const roomBias = preferred === player.position ? ROOM_PROFILE_BONUS : 0;
    const jitter = deterministicJitter(`${simulationSeed}|${managerId}|${overallPick}|${player.id}`)
      * tolerance.jitterAmplitude;
    const score = marketScore + rosterNeed + historyBias + rosterConstructionBias + roomBias + jitter;

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

function managerPositionBias(
  managerId: string,
  position: Position,
  round: number,
  roster: PlayerRanking[],
): number {
  const profile = historicalProfiles.find((candidate) => candidate.manager_id === managerId);
  if (!profile) return 0;

  const phase = phaseForRound(round);
  const historicalPosition = historyPosition(position);
  const sequenceProbability = historicalSequencePositionProbability({
    managerId,
    position,
    round,
    priorPositions: roster.map((player) => player.position),
  });
  const managerProbability =
    sequenceProbability ??
    profile.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition] ??
    0;
  const leagueValues = round === 1
    ? round1Profiles
      .map((candidate) => candidate.round1_position_probabilities_recency_weighted[historicalPosition])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    : historicalProfiles
      .map((candidate) => candidate.phase_position_probabilities_recency_weighted[phase]?.[historicalPosition])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const leagueProbability = leagueValues.length
    ? leagueValues.reduce((sum, value) => sum + value, 0) / leagueValues.length
    : 0;
  const confidence = clamp(profile.draft_count / 10, 0.35, 1);
  const maxBias = simulationToleranceForRound(round).maxManagerPositionBias;
  return clamp(
    (managerProbability - leagueProbability) * 70 * confidence,
    -maxBias,
    maxBias,
  );
}

function posteriorDistribution(
  stat: SequenceStat,
  prior: Record<HistoricalPosition, number>,
  priorWeight: number,
): Record<HistoricalPosition, number> {
  const [, weightedTotal, weightedCounts] = stat;
  const denominator = weightedTotal + priorWeight;
  if (denominator <= 0) return prior;

  return HISTORICAL_POSITIONS.reduce<Record<HistoricalPosition, number>>((result, position) => {
    result[position] = ((weightedCounts[position] ?? 0) + priorWeight * prior[position]) / denominator;
    return result;
  }, emptyHistoricalDistribution());
}

function conditionOnRepeat(
  prior: Record<HistoricalPosition, number>,
  repeatedPosition: HistoricalPosition,
  stat: RepeatStat,
  priorWeight: number,
): Record<HistoricalPosition, number> {
  const [, weightedTotal, weightedSame] = stat;
  const previousProbability = prior[repeatedPosition];
  const denominator = weightedTotal + priorWeight;
  if (denominator <= 0) return prior;

  const repeatProbability = clamp(
    (weightedSame + priorWeight * previousProbability) / denominator,
    0,
    1,
  );
  const remainingPrior = Math.max(0, 1 - previousProbability);
  const result = { ...prior, [repeatedPosition]: repeatProbability };

  if (remainingPrior <= 1e-9) {
    for (const position of HISTORICAL_POSITIONS) {
      if (position !== repeatedPosition) result[position] = 0;
    }
    return result;
  }

  const scale = (1 - repeatProbability) / remainingPrior;
  for (const position of HISTORICAL_POSITIONS) {
    if (position !== repeatedPosition) result[position] = prior[position] * scale;
  }
  return result;
}

function normalizeDistribution(
  input: Record<HistoricalPosition, number>,
): Record<HistoricalPosition, number> {
  const total = HISTORICAL_POSITIONS.reduce((sum, position) => sum + (input[position] ?? 0), 0);
  if (total <= 0) return emptyHistoricalDistribution();
  return HISTORICAL_POSITIONS.reduce<Record<HistoricalPosition, number>>((result, position) => {
    result[position] = (input[position] ?? 0) / total;
    return result;
  }, emptyHistoricalDistribution());
}

const HISTORICAL_POSITIONS: HistoricalPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

function emptyHistoricalDistribution(): Record<HistoricalPosition, number> {
  return { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
}

function historyPosition(position: Position): HistoricalPosition {
  return position === 'DST' ? 'DEF' : position;
}

function historicalRosterTotal(profile: SimulatorManagerProfile): number {
  return HISTORICAL_POSITIONS.reduce(
    (sum, position) => sum + (profile.average_final_roster[position] ?? 0),
    0,
  );
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

function positionCounts(roster: readonly PlayerRanking[]): Record<Position, number> {
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
