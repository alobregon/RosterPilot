import type {
  DraftConfig,
  DraftPick,
  DraftStrategy,
  PlayerRanking,
  Position,
  Recommendation,
  RecommendationBreakdown,
} from './types';
import { draftSlotForOverallPick, followingUserOverallPick, nextUserOverallPick, picksForSlot, roundForOverallPick } from './draft';

const WEIGHTS = {
  rankingValue: 0.42,
  rosterFit: 0.2,
  tierUrgency: 0.15,
  valueAtPick: 0.15,
  byeWeekFit: 0.03,
  futureAvailability: 0.05,
} as const;

const POSITION_RUN_WINDOW = 8;
const RANKING_VALUE_HALF_LIFE = 100;
const RECOMMENDATION_SHARE_TEMPERATURE = 8;
const STRATEGY_MAX_ADJUSTMENT = 6;
const FAVORITE_MAX_ADJUSTMENT = 5;

interface DraftTrendContext {
  picks: DraftPick[];
  players: PlayerRanking[];
  currentOverallPick: number;
  config?: DraftConfig;
}

interface FutureAvailabilityResult {
  urgency: number;
  selectionPick: number;
  returnPick: number | null;
  interveningPicks: number;
  uniqueOpponentTeams: number;
  strongNeedTeams: number;
  demandScore: number;
  recentRunCount: number;
  label: 'LIKELY' | 'UNCERTAIN' | 'UNLIKELY' | 'FINAL_PICK';
}

type ScoredRecommendation = Omit<Recommendation, 'recommendationPercent'> & {
  availability: FutureAvailabilityResult;
};

export function recommendPlayers(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  favoritePlayerIds?: readonly string[];
  limit?: number;
}): Recommendation[] {
  const { players, picks, config, currentOverallPick, favoritePlayerIds = [], limit = 3 } = args;
  const favoriteIds = new Set(favoritePlayerIds);
  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const allAvailable = players.filter((player) => !draftedIds.has(player.id));
  if (allAvailable.length === 0) return [];

  const userPicks = picksForSlot(picks, config.userDraftSlot);
  const userPlayerIds = new Set(userPicks.map((pick) => pick.playerId));
  const userRoster = players.filter((player) => userPlayerIds.has(player.id));
  const forcedPositions = mandatoryPositions(userRoster, config);
  const available = forcedPositions.size
    ? allAvailable.filter((player) => forcedPositions.has(player.position))
    : allAvailable;
  if (available.length === 0) return [];
  const selectionPick = nextUserOverallPick(currentOverallPick, config);

  const scored: ScoredRecommendation[] = available.map((player) => {
    const draftContext: DraftTrendContext = { picks, players, currentOverallPick, config };
    const availability = futureAvailabilityForPlayer(player, available, picks, players, config, currentOverallPick);
    const breakdown: RecommendationBreakdown = {
      rankingValue: rankingValue(player.overallRank),
      rosterFit: rosterFit(player.position, userRoster, config, draftContext),
      tierUrgency: tierUrgency(player, available),
      valueAtPick: valueAtPick(player, selectionPick),
      byeWeekFit: byeWeekFit(player, userRoster),
      futureAvailability: availability.urgency,
      strategyFit: strategyFit(player, userRoster, config, selectionPick),
      favoriteFit: favoriteFit(player, selectionPick, favoriteIds.has(player.id)),
    };

    const baseScore =
      breakdown.rankingValue * WEIGHTS.rankingValue +
      breakdown.rosterFit * WEIGHTS.rosterFit +
      breakdown.tierUrgency * WEIGHTS.tierUrgency +
      breakdown.valueAtPick * WEIGHTS.valueAtPick +
      breakdown.byeWeekFit * WEIGHTS.byeWeekFit +
      breakdown.futureAvailability * WEIGHTS.futureAvailability;
    const strategyAdjustment = ((breakdown.strategyFit - 50) / 50) * STRATEGY_MAX_ADJUSTMENT;
    const favoriteAdjustment = ((breakdown.favoriteFit - 50) / 50) * FAVORITE_MAX_ADJUSTMENT;
    const rawScore = clamp(baseScore + strategyAdjustment + favoriteAdjustment, 0, 100);

    return {
      player,
      rawScore,
      breakdown,
      availability,
      reasons: buildReasons(
        player,
        breakdown,
        available,
        selectionPick,
        userRoster,
        draftContext,
        availability,
        favoriteIds.has(player.id),
      ),
    };
  });

  const top = scored
    .sort((a, b) => b.rawScore - a.rawScore || a.player.overallRank - b.player.overallRank)
    .slice(0, limit);

  const shares = relativeRecommendationPercents(top.map((item) => item.rawScore));
  return top.map(({ availability: _availability, ...item }, index) => ({
    ...item,
    recommendationPercent: shares[index] ?? 0,
  }));
}

export function futureAvailabilityForPlayer(
  player: PlayerRanking,
  available: PlayerRanking[],
  picks: DraftPick[],
  players: PlayerRanking[],
  config: DraftConfig,
  currentOverallPick: number,
): FutureAvailabilityResult {
  const selectionPick = nextUserOverallPick(currentOverallPick, config);
  const proposedReturnPick = followingUserOverallPick(currentOverallPick, config);
  const draftEnd = config.teamCount * totalRosterSlots(config);
  if (proposedReturnPick > draftEnd) {
    return {
      urgency: 50,
      selectionPick,
      returnPick: null,
      interveningPicks: 0,
      uniqueOpponentTeams: 0,
      strongNeedTeams: 0,
      demandScore: 0,
      recentRunCount: recentPositionRun(player.position, { picks, players, currentOverallPick, config }).count,
      label: 'FINAL_PICK',
    };
  }
  const returnPick = proposedReturnPick;
  const opportunities = opponentPickOpportunities(selectionPick, returnPick, config.teamCount, config.userDraftSlot);
  const uniqueSlots = [...new Set(opportunities)];
  const playerById = new Map(players.map((candidate) => [candidate.id, candidate]));
  const picksBySlot = new Map<number, DraftPick[]>();
  for (const pick of picks) {
    const list = picksBySlot.get(pick.draftSlot) ?? [];
    list.push(pick);
    picksBySlot.set(pick.draftSlot, list);
  }

  let strongNeedTeams = 0;
  let totalNeed = 0;
  for (const slot of uniqueSlots) {
    const roster = (picksBySlot.get(slot) ?? [])
      .map((pick) => playerById.get(pick.playerId))
      .filter((candidate): candidate is PlayerRanking => Boolean(candidate));
    const need = positionNeedScore(player.position, roster, config);
    const opportunityCount = opportunities.filter((candidate) => candidate === slot).length;
    const adjustedNeed = clamp(need + Math.max(0, opportunityCount - 1) * 8, 0, 100);
    totalNeed += adjustedNeed;
    if (need >= 80) strongNeedTeams += 1;
  }

  const demandScore = uniqueSlots.length ? totalNeed / uniqueSlots.length : 0;
  const rankPressure = clamp(50 + (returnPick - player.overallRank) * 4, 5, 95);
  const recentRunCount = recentPositionRun(player.position, { picks, players, currentOverallPick, config }).count;
  const runPressure = positionRunPressure(player.position, recentRunCount);
  const tierPressure = tierUrgency(player, available);
  const urgency = clamp(
    rankPressure * 0.5 + demandScore * 0.3 + runPressure * 0.12 + tierPressure * 0.08,
    0,
    100,
  );

  return {
    urgency,
    selectionPick,
    returnPick,
    interveningPicks: opportunities.length,
    uniqueOpponentTeams: uniqueSlots.length,
    strongNeedTeams,
    demandScore,
    recentRunCount,
    label: urgency >= 68 ? 'UNLIKELY' : urgency >= 42 ? 'UNCERTAIN' : 'LIKELY',
  };
}

export function opponentPickOpportunities(
  selectionPick: number,
  returnPick: number,
  teamCount: number,
  userDraftSlot: number,
): number[] {
  const slots: number[] = [];
  for (let overallPick = selectionPick + 1; overallPick < returnPick; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, teamCount);
    if (slot !== userDraftSlot) slots.push(slot);
  }
  return slots;
}

export function relativeRecommendationPercents(scores: number[]): number[] {
  if (scores.length === 0) return [];
  if (scores.length === 1) return [100];

  const maxScore = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - maxScore) / RECOMMENDATION_SHARE_TEMPERATURE));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * 100);
  const result = exact.map((value) => Math.floor(value));
  let remaining = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < remaining; i += 1) result[order[i % order.length].index] += 1;
  return result;
}

function rankingValue(rank: number): number {
  if (rank <= 1) return 100;
  return clamp(100 * Math.pow(0.5, (rank - 1) / RANKING_VALUE_HALF_LIFE), 0, 100);
}

function rosterFit(
  position: Position,
  roster: PlayerRanking[],
  config: DraftConfig,
  draftContext: DraftTrendContext,
): number {
  const counts = positionCounts(roster);

  if (position === 'K' || position === 'DST') {
    const target = position === 'K' ? config.kStarters : config.dstStarters;
    if (target <= 0) return 0;
    if (counts[position] >= target) return 5;
    const lateThreshold = totalRosterSlots(config) - config.dstStarters - config.kStarters;
    if (roster.length >= lateThreshold) return 88;
    if (position === 'DST') {
      const run = recentPositionRun('DST', draftContext);
      if (run.count >= 4) return 72;
      if (run.count === 3) return 58;
      if (run.count === 2) return 36;
    }
    return 10;
  }

  const starterTarget: Partial<Record<Position, number>> = {
    QB: config.qbStarters,
    RB: config.rbStarters,
    WR: config.wrStarters,
    TE: config.teStarters,
  };
  if (counts[position] < (starterTarget[position] ?? 0)) return 100;

  if (
    (position === 'RB' || position === 'WR' || position === 'TE') &&
    config.flexStarters > 0 &&
    baseSkillStarterDeficit(counts, config) === 0
  ) {
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const baseFlexEligible = config.rbStarters + config.wrStarters + config.teStarters;
    if (flexEligible < baseFlexEligible + config.flexStarters) {
      if (position === 'WR') return 86;
      if (position === 'RB') return 84;
      return 65;
    }
  }

  if (position === 'WR') {
    const depth = Math.max(0, counts.WR - config.wrStarters);
    if (depth <= 1) return 74;
    if (depth === 2) return 66;
    if (depth === 3) return 58;
    return 44;
  }
  if (position === 'RB') {
    const depth = Math.max(0, counts.RB - config.rbStarters);
    if (depth <= 1) return 70;
    if (depth === 2) return 62;
    if (depth === 3) return 54;
    return 40;
  }
  if (position === 'TE') return 35;
  return 25;
}

function positionNeedScore(position: Position, roster: PlayerRanking[], config: DraftConfig): number {
  const counts = positionCounts(roster);
  const rosterLength = roster.length;
  const lateThreshold = totalRosterSlots(config) - config.dstStarters - config.kStarters;

  if (position === 'QB') return counts.QB < config.qbStarters ? 65 : 15;
  if (position === 'DST') return counts.DST < config.dstStarters && rosterLength >= lateThreshold - 2 ? 82 : 8;
  if (position === 'K') return counts.K < config.kStarters && rosterLength >= lateThreshold - 1 ? 82 : 5;

  const starterTarget = position === 'RB' ? config.rbStarters : position === 'WR' ? config.wrStarters : config.teStarters;
  if (counts[position] < starterTarget) return position === 'TE' ? 72 : 100;

  const flexEligible = counts.RB + counts.WR + counts.TE;
  const flexTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  if (baseSkillStarterDeficit(counts, config) === 0 && flexEligible < flexTarget) {
    return position === 'TE' ? 68 : 82;
  }
  if (position === 'WR') return 52;
  if (position === 'RB') return 50;
  return 20;
}

function positionCounts(roster: PlayerRanking[]): Record<Position, number> {
  return roster.reduce<Record<Position, number>>(
    (acc, player) => {
      acc[player.position] += 1;
      return acc;
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );
}

function baseSkillStarterDeficit(counts: Record<Position, number>, config: DraftConfig): number {
  return (
    Math.max(0, config.rbStarters - counts.RB) +
    Math.max(0, config.wrStarters - counts.WR) +
    Math.max(0, config.teStarters - counts.TE)
  );
}

function mandatoryPositions(roster: PlayerRanking[], config: DraftConfig): Set<Position> {
  const counts = positionCounts(roster);
  const remainingSlots = Math.max(0, totalRosterSlots(config) - roster.length);
  const fixedDeficits: Array<[Position, number]> = [
    ['QB', Math.max(0, config.qbStarters - counts.QB)],
    ['RB', Math.max(0, config.rbStarters - counts.RB)],
    ['WR', Math.max(0, config.wrStarters - counts.WR)],
    ['TE', Math.max(0, config.teStarters - counts.TE)],
    ['DST', Math.max(0, config.dstStarters - counts.DST)],
    ['K', Math.max(0, config.kStarters - counts.K)],
  ];
  const fixedSkillDeficit = fixedDeficits
    .filter(([position]) => position === 'RB' || position === 'WR' || position === 'TE')
    .reduce((sum, [, deficit]) => sum + deficit, 0);
  const totalSkillTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  const skillCount = counts.RB + counts.WR + counts.TE;
  const totalSkillDeficit = Math.max(0, totalSkillTarget - skillCount);
  const extraFlexDeficit = Math.max(0, totalSkillDeficit - fixedSkillDeficit);
  const minimumRequiredSlots = fixedDeficits.reduce((sum, [, deficit]) => sum + deficit, 0) + extraFlexDeficit;

  if (remainingSlots > minimumRequiredSlots || minimumRequiredSlots === 0) return new Set<Position>();

  const required = new Set<Position>();
  for (const [position, deficit] of fixedDeficits) if (deficit > 0) required.add(position);
  if (extraFlexDeficit > 0) {
    required.add('RB');
    required.add('WR');
    required.add('TE');
  }
  return required;
}

function totalRosterSlots(config: DraftConfig): number {
  return (
    config.qbStarters +
    config.rbStarters +
    config.wrStarters +
    config.teStarters +
    config.flexStarters +
    config.dstStarters +
    config.kStarters +
    config.benchSpots
  );
}

function favoriteFit(player: PlayerRanking, selectionPick: number, isFavorite: boolean): number {
  if (!isFavorite) return 50;

  const valueGap = selectionPick - player.overallRank;
  if (valueGap >= 10) return 100;
  if (valueGap >= 5) return 90;
  if (valueGap >= 0) return 80;
  if (valueGap >= -5) return 65;
  if (valueGap >= -10) return 55;
  return 51;
}

function strategyFit(
  player: PlayerRanking,
  roster: PlayerRanking[],
  config: DraftConfig,
  selectionPick: number,
): number {
  const strategy = config.draftStrategy ?? 'BALANCED';
  if (strategy === 'BALANCED') return 50;

  const counts = positionCounts(roster);
  const round = roundForOverallPick(selectionPick, config.teamCount);

  if (strategy === 'HERO_RB') {
    if (counts.RB === 0) return player.position === 'RB' ? 100 : player.position === 'WR' ? 65 : 50;
    if (round <= 6) return player.position === 'RB' ? 25 : player.position === 'WR' ? 90 : player.position === 'TE' ? 65 : 50;
    return player.position === 'RB' ? 70 : player.position === 'WR' ? 75 : 50;
  }

  if (strategy === 'ZERO_RB') {
    if (round <= 5) {
      if (player.position === 'RB') return 10;
      if (player.position === 'WR') return 100;
      if (player.position === 'TE') return 82;
      return 55;
    }
    if (player.position === 'RB') return counts.RB < config.rbStarters ? 100 : 78;
    return player.position === 'WR' ? 72 : 50;
  }

  if (strategy === 'ROBUST_RB') {
    if (round <= 5 && counts.RB < 3) return player.position === 'RB' ? 100 : player.position === 'WR' ? 55 : 45;
    return player.position === 'WR' ? 82 : player.position === 'RB' ? 45 : 50;
  }

  if (strategy === 'WR_HEAVY') {
    if (counts.WR < Math.max(config.wrStarters + 1, 4)) return player.position === 'WR' ? 100 : player.position === 'RB' ? 58 : 48;
    return player.position === 'WR' ? 72 : player.position === 'RB' ? 65 : 50;
  }

  if (strategy === 'LATE_QB') {
    if (player.position === 'QB') {
      if (counts.QB > 0) return 20;
      return round < 7 ? 5 : 100;
    }
    return round < 7 ? 70 : 50;
  }

  if (strategy === 'ELITE_TE') {
    if (counts.TE === 0 && player.position === 'TE') {
      if (player.tier != null && player.tier <= 2) return 100;
      return 65;
    }
    if (player.position === 'TE' && counts.TE > 0) return 20;
    return 60;
  }

  if (strategy === 'UPSIDE_HEAVY') {
    const upside = player.sourceMetadata?.upsideRating;
    if (upside == null) return 50;
    return clamp(20 + (upside - 1) * 20, 20, 100);
  }

  return 50;
}

function strategyLabel(strategy: DraftStrategy): string {
  const labels: Record<DraftStrategy, string> = {
    BALANCED: 'Balanced',
    HERO_RB: 'Hero RB',
    ZERO_RB: 'Zero RB',
    ROBUST_RB: 'Robust RB',
    WR_HEAVY: 'WR Heavy',
    LATE_QB: 'Late QB',
    ELITE_TE: 'Elite TE',
    UPSIDE_HEAVY: 'Upside Heavy',
  };
  return labels[strategy];
}

function tierUrgency(player: PlayerRanking, available: PlayerRanking[]): number {
  if (player.tier == null) return 50;
  const positionTiers = available
    .filter((candidate) => candidate.position === player.position && candidate.tier != null)
    .map((candidate) => candidate.tier as number);
  if (positionTiers.length === 0) return 50;

  const bestAvailableTier = Math.min(...positionTiers);
  if (player.tier !== bestAvailableTier) return 20;

  const peers = available.filter(
    (candidate) => candidate.position === player.position && candidate.tier === player.tier,
  ).length;
  if (peers === 1) return 100;
  if (peers === 2) return 88;
  if (peers <= 4) return 72;
  return 50;
}

function valueAtPick(player: PlayerRanking, selectionPick: number): number {
  const gap = selectionPick - player.overallRank;
  return clamp(50 + gap * 2.5, 10, 100);
}

function byeWeekFit(player: PlayerRanking, roster: PlayerRanking[]): number {
  if (player.byeWeek == null) return 50;
  const sameBye = roster.filter((existing) => existing.byeWeek === player.byeWeek);
  const overlap = sameBye.length;
  if (player.position === 'QB' && sameBye.some((existing) => existing.position === 'QB')) return 15;
  if (player.position === 'TE' && sameBye.some((existing) => existing.position === 'TE')) return 25;
  if (overlap === 0) return 100;
  if (overlap === 1) return 82;
  if (overlap === 2) return 58;
  if (overlap === 3) return 35;
  return 15;
}

function buildReasons(
  player: PlayerRanking,
  breakdown: RecommendationBreakdown,
  available: PlayerRanking[],
  selectionPick: number,
  userRoster: PlayerRanking[],
  draftContext: DraftTrendContext,
  availability: FutureAvailabilityResult,
  isFavorite: boolean,
): string[] {
  const reasons: string[] = [];
  const valueGap = selectionPick - player.overallRank;

  if (availability.label === 'UNLIKELY' && availability.returnPick != null) {
    reasons.push(`Unlikely to make it back to pick #${availability.returnPick}`);
  } else if (availability.label === 'LIKELY' && availability.returnPick != null && availability.interveningPicks >= 4) {
    reasons.push(`Reasonable chance to survive to pick #${availability.returnPick}`);
  }
  if (availability.strongNeedTeams >= 2) {
    reasons.push(`${availability.strongNeedTeams} teams before your next turn show strong ${player.position} need`);
  }

  const strategy = draftContext.config?.draftStrategy ?? 'BALANCED';
  if (breakdown.strategyFit >= 85 && strategy !== 'BALANCED') {
    reasons.push(`Strong fit for ${strategyLabel(strategy)} strategy`);
  }

  if (isFavorite && breakdown.favoriteFit >= 55) {
    if (valueGap >= 5) reasons.push(`Favorite who has fallen ${valueGap} picks past your ranking`);
    else if (valueGap >= 0) reasons.push('Favorite available at or after your ranking');
    else reasons.push(`Favorite within ${Math.abs(valueGap)} picks of your ranking`);
  }

  const run = recentPositionRun(player.position, draftContext);
  const runThreshold = positionRunThreshold(player.position);
  if (run.count >= runThreshold) {
    reasons.push(`${run.count} ${player.position}s selected in the last ${run.windowSize} picks; run is developing`);
  }

  if (valueGap >= 5) reasons.push(`${valueGap} picks of ranking value at your selection`);
  if (breakdown.rosterFit >= 90) reasons.push(`Fills a priority ${player.position} starter slot`);
  if ((player.position === 'K' || player.position === 'DST') && breakdown.rosterFit >= 80) {
    reasons.push(`Late-round ${player.position} starter slot is still open`);
  }

  if (player.tier != null) {
    const sameTierRemaining = available.filter(
      (candidate) => candidate.position === player.position && candidate.tier === player.tier,
    ).length;
    if (sameTierRemaining === 1) reasons.push(`Final ${player.position} remaining in Tier ${player.tier}`);
    else if (sameTierRemaining <= 3) reasons.push(`Only ${sameTierRemaining} ${player.position}s remain in Tier ${player.tier}`);
  }

  if (player.byeWeek != null) {
    const overlap = userRoster.filter((existing) => existing.byeWeek === player.byeWeek).length;
    if (overlap === 0 && userRoster.length >= 3) reasons.push(`Bye Week ${player.byeWeek} avoids current roster overlap`);
    else if (overlap >= 2) reasons.push(`Bye Week ${player.byeWeek} overlaps ${overlap} rostered players`);
  }

  if (breakdown.rankingValue >= 85) reasons.push('Among the strongest remaining values in your rankings');
  if (reasons.length === 0) reasons.push('Balanced combination of ranking value and roster fit');
  return reasons.slice(0, 3);
}

function recentPositionRun(position: Position, context: DraftTrendContext): { count: number; windowSize: number } {
  const recentPicks = context.picks
    .filter((pick) => pick.overallPick < context.currentOverallPick)
    .slice(-POSITION_RUN_WINDOW);
  const playerById = new Map(context.players.map((player) => [player.id, player]));
  const count = recentPicks.reduce(
    (total, pick) => total + (playerById.get(pick.playerId)?.position === position ? 1 : 0),
    0,
  );
  return { count, windowSize: recentPicks.length };
}

function positionRunThreshold(position: Position): number {
  if (position === 'DST') return 2;
  if (position === 'QB' || position === 'TE' || position === 'K') return 3;
  return 4;
}

function positionRunPressure(position: Position, count: number): number {
  const threshold = positionRunThreshold(position);
  if (count < threshold) return 10;
  if (count === threshold) return 65;
  if (count === threshold + 1) return 82;
  return 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
