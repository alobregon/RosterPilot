import { followingUserOverallPick, nextUserOverallPick, draftSlotForOverallPick } from './draft';
import type { DraftConfig, DraftPick, PlayerRanking, Position } from './types';

const SUPPORTED_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE']);
const MAX_VALIDATED_MARKET_CANDIDATE_RANK = 20;

// Final Model C fit on 2018-2025 Purple League survival samples.
// Numeric inputs are standardized with the training-set means/scales below.
const MODEL = {
  intercept: 0.7230871219351969,
  numeric: {
    adpDistance: { coefficient: 0.4010682798767391, mean: -1.9878194444444446, scale: 14.295430028146125 },
    returnDistance: { coefficient: -1.2518533085346493, mean: 10, scale: 5.729165151514951 },
    averageNeed: { coefficient: -1.3286831209119223, mean: 48.33026342041446, scale: 33.966233969995955 },
    maximumNeed: { coefficient: -0.036344030142671, mean: 57.81229166666667, scale: 35.148365720241095 },
    strongNeedCount: { coefficient: 0.12225843104992064, mean: 2.5058333333333334, scale: 4.647441874001462 },
  },
  position: {
    QB: 0.8600678947570407,
    RB: 0.020957031791359826,
    TE: -0.20127155980836972,
    WR: 0.030249748766299274,
  } as Record<'QB' | 'RB' | 'WR' | 'TE', number>,
  // Platt scaling fit on chronological 2019-2025 out-of-fold predictions.
  calibration: {
    intercept: -0.2175733250153561,
    slope: 1.0156138054234962,
  },
} as const;

export interface SurvivalProbabilityResult {
  probability: number;
  returnPick: number;
  interveningPicks: number;
  marketCandidateRank: number;
  averageOpponentNeed: number;
  maximumOpponentNeed: number;
  strongNeedOpportunities: number;
}

/**
 * Calibrated estimate that a QB/RB/WR/TE candidate remains available until
 * the user's following pick.
 *
 * The released probability intentionally excludes manager identity and
 * historical reach behavior. Chronological validation showed that ADP,
 * return distance, and opponent roster need were the durable predictors.
 *
 * Validation covered the top 8/12/20 available market candidates. Candidates
 * outside the top 20, players without ADP, K/DST, and final-turn situations
 * return null instead of extrapolating beyond the tested domain.
 */
export function survivalProbabilityForPlayer(args: {
  player: PlayerRanking;
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
}): SurvivalProbabilityResult | null {
  const { player, players, picks, config, currentOverallPick } = args;
  if (player.adp == null || !isSupportedPosition(player.position)) return null;

  const selectionPick = nextUserOverallPick(currentOverallPick, config);
  const returnPick = followingUserOverallPick(currentOverallPick, config);
  const draftEnd = config.teamCount * totalRosterSlots(config);
  if (returnPick > draftEnd) return null;

  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const marketCandidates = players
    .filter((candidate) => !draftedIds.has(candidate.id))
    .filter((candidate) => candidate.adp != null && isSupportedPosition(candidate.position))
    .sort((a, b) => (a.adp ?? Number.POSITIVE_INFINITY) - (b.adp ?? Number.POSITIVE_INFINITY) || a.overallRank - b.overallRank);
  const marketCandidateRank = marketCandidates.findIndex((candidate) => candidate.id === player.id) + 1;
  if (marketCandidateRank <= 0 || marketCandidateRank > MAX_VALIDATED_MARKET_CANDIDATE_RANK) return null;

  const playerById = new Map(players.map((candidate) => [candidate.id, candidate]));
  const rosterBySlot = new Map<number, PlayerRanking[]>();
  for (let slot = 1; slot <= config.teamCount; slot += 1) rosterBySlot.set(slot, []);
  for (const pick of picks) {
    const draftedPlayer = playerById.get(pick.playerId);
    if (draftedPlayer) rosterBySlot.get(pick.draftSlot)?.push(draftedPlayer);
  }

  const needs: number[] = [];
  for (let overallPick = selectionPick + 1; overallPick < returnPick; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, config.teamCount);
    if (slot === config.userDraftSlot) continue;
    needs.push(positionNeedScore(player.position, rosterBySlot.get(slot) ?? [], config));
  }
  if (!needs.length) return null;

  const averageNeed = average(needs);
  const maximumNeed = Math.max(...needs);
  const strongNeedCount = needs.filter((need) => need >= 80).length;
  const adpDistance = player.adp - selectionPick;
  const returnDistance = returnPick - selectionPick;

  let rawLogit = MODEL.intercept;
  rawLogit += standardizedContribution(adpDistance, MODEL.numeric.adpDistance);
  rawLogit += standardizedContribution(returnDistance, MODEL.numeric.returnDistance);
  rawLogit += standardizedContribution(averageNeed, MODEL.numeric.averageNeed);
  rawLogit += standardizedContribution(maximumNeed, MODEL.numeric.maximumNeed);
  rawLogit += standardizedContribution(strongNeedCount, MODEL.numeric.strongNeedCount);
  rawLogit += MODEL.position[player.position];

  const calibratedLogit = MODEL.calibration.intercept + MODEL.calibration.slope * rawLogit;
  const probability = sigmoid(calibratedLogit);

  return {
    probability,
    returnPick,
    interveningPicks: needs.length,
    marketCandidateRank,
    averageOpponentNeed: averageNeed,
    maximumOpponentNeed: maximumNeed,
    strongNeedOpportunities: strongNeedCount,
  };
}

function standardizedContribution(
  value: number,
  feature: { coefficient: number; mean: number; scale: number },
): number {
  return feature.coefficient * ((value - feature.mean) / feature.scale);
}

function positionNeedScore(position: 'QB' | 'RB' | 'WR' | 'TE', roster: PlayerRanking[], config: DraftConfig): number {
  const counts = positionCounts(roster);
  if (position === 'QB') return counts.QB < config.qbStarters ? 65 : counts.QB === config.qbStarters ? 12 : 2;

  const starterTarget = position === 'RB' ? config.rbStarters : position === 'WR' ? config.wrStarters : config.teStarters;
  if (counts[position] < starterTarget) return position === 'TE' ? 72 : 100;

  const flexEligible = counts.RB + counts.WR + counts.TE;
  const flexTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  if (baseSkillStarterDeficit(counts, config) === 0 && flexEligible < flexTarget) {
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
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });
}

function baseSkillStarterDeficit(counts: Record<Position, number>, config: DraftConfig): number {
  return Math.max(0, config.rbStarters - counts.RB)
    + Math.max(0, config.wrStarters - counts.WR)
    + Math.max(0, config.teStarters - counts.TE);
}

function isSupportedPosition(position: Position): position is 'QB' | 'RB' | 'WR' | 'TE' {
  return SUPPORTED_POSITIONS.has(position);
}

function totalRosterSlots(config: DraftConfig): number {
  return config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters
    + config.dstStarters + config.kStarters + config.benchSpots;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}
