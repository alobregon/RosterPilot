import type {
  AvailabilityLabel,
  DraftConfig,
  DraftPick,
  DraftStrategy,
  PlayerRanking,
  Position,
  PositionTrendStatus,
  Recommendation,
  RecommendationBreakdown,
} from './types';
import { draftSlotForOverallPick, followingUserOverallPick, nextUserOverallPick, roundForOverallPick } from './draft';
import { buildPositionTrends, trendPressure, type PositionTrend } from './trends';

const WEIGHTS = {
  rankingValue: 0.42,
  rosterFit: 0.20,
  tierUrgency: 0.15,
  valueAtPick: 0.15,
  byeWeekFit: 0.03,
  futureAvailability: 0.05,
} as const;
const RANKING_VALUE_HALF_LIFE = 100;
const RECOMMENDATION_SHARE_TEMPERATURE = 8;
const STRATEGY_MAX_ADJUSTMENT = 6;
const FAVORITE_MAX_ADJUSTMENT = 5;

export interface FutureAvailabilityResult {
  urgency: number;
  selectionPick: number;
  returnPick: number | null;
  interveningPicks: number;
  uniqueOpponentTeams: number;
  strongNeedTeams: number;
  demandScore: number;
  recentRunCount: number;
  label: AvailabilityLabel;
}

interface RecommendationContext {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  selectionPick: number;
  returnPick: number | null;
  draftEnd: number;
  playerById: Map<string, PlayerRanking>;
  picksBySlot: Map<number, DraftPick[]>;
  rosterBySlot: Map<number, PlayerRanking[]>;
  userRoster: PlayerRanking[];
  trends: Record<Position, PositionTrend>;
  opportunities: number[];
  uniqueOpponentSlots: number[];
}

interface ScoredCandidate {
  player: PlayerRanking;
  rawScore: number;
  breakdown: RecommendationBreakdown;
  availability: FutureAvailabilityResult;
  positionTrend: PositionTrendStatus;
  marketFall?: number;
  isFavorite: boolean;
}

export function recommendPlayers(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  favoritePlayerIds?: readonly string[];
  limit?: number;
}): Recommendation[] {
  const { players, picks, config, currentOverallPick, favoritePlayerIds = [], limit = 3 } = args;
  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const allAvailable = players.filter((player) => !draftedIds.has(player.id));
  if (!allAvailable.length || limit <= 0) return [];

  const context = buildRecommendationContext(players, picks, config, currentOverallPick);
  const forcedPositions = mandatoryPositions(context.userRoster, config);
  const available = forcedPositions.size
    ? allAvailable.filter((player) => forcedPositions.has(player.position))
    : allAvailable;
  if (!available.length) return [];

  const favoriteIds = new Set(favoritePlayerIds);
  const scored = available.map((player): ScoredCandidate => {
    const availability = futureAvailabilityWithContext(player, available, context);
    const isFavorite = favoriteIds.has(player.id);
    const breakdown: RecommendationBreakdown = {
      rankingValue: rankingValue(player.overallRank),
      rosterFit: rosterFit(player.position, context.userRoster, config, context.trends),
      tierUrgency: tierUrgency(player, available),
      valueAtPick: valueAtPick(player, context.selectionPick),
      byeWeekFit: byeWeekFit(player, context.userRoster),
      futureAvailability: availability.urgency,
      strategyFit: strategyFit(player, context.userRoster, config, context.selectionPick),
      favoriteFit: favoriteFit(player, context.selectionPick, isFavorite),
    };

    const baseScore =
      breakdown.rankingValue * WEIGHTS.rankingValue +
      breakdown.rosterFit * WEIGHTS.rosterFit +
      breakdown.tierUrgency * WEIGHTS.tierUrgency +
      breakdown.valueAtPick * WEIGHTS.valueAtPick +
      breakdown.byeWeekFit * WEIGHTS.byeWeekFit +
      breakdown.futureAvailability * WEIGHTS.futureAvailability;
    const strategyAdjustment = ((breakdown.strategyFit - 50) / 50) * STRATEGY_MAX_ADJUSTMENT;
    const favoriteAdjustment = favoriteScoreAdjustment(player, breakdown.favoriteFit, context.selectionPick, config);
    const rankDisciplinePenalty = earlyRoundRankPenalty(player, context.selectionPick, config, isFavorite);
    const rawScore = clamp(baseScore + strategyAdjustment + favoriteAdjustment - rankDisciplinePenalty, 0, 100);
    const marketFall = player.adp != null ? Math.round((context.selectionPick - player.adp) * 10) / 10 : undefined;

    return {
      player,
      rawScore,
      breakdown,
      availability,
      positionTrend: context.trends[player.position].status,
      marketFall: marketFall != null && marketFall >= 3 ? marketFall : undefined,
      isFavorite,
    };
  });

  const top = scored
    .sort((a, b) => b.rawScore - a.rawScore || a.player.overallRank - b.player.overallRank)
    .slice(0, limit);
  const shares = relativeRecommendationPercents(top.map((item) => item.rawScore));

  return top.map((item, index) => ({
    player: item.player,
    rawScore: item.rawScore,
    recommendationPercent: shares[index] ?? 0,
    availabilityLabel: item.availability.label,
    returnPick: item.availability.returnPick ?? undefined,
    positionTrend: item.positionTrend,
    marketFall: item.marketFall,
    breakdown: item.breakdown,
    reasons: buildReasons(item, available, context),
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
  return futureAvailabilityWithContext(player, available, buildRecommendationContext(players, picks, config, currentOverallPick));
}

export function opponentPickOpportunities(selectionPick: number, returnPick: number, teamCount: number, userDraftSlot: number): number[] {
  const slots: number[] = [];
  for (let overallPick = selectionPick + 1; overallPick < returnPick; overallPick += 1) {
    const slot = draftSlotForOverallPick(overallPick, teamCount);
    if (slot !== userDraftSlot) slots.push(slot);
  }
  return slots;
}

export function relativeRecommendationPercents(scores: number[]): number[] {
  if (!scores.length) return [];
  if (scores.length === 1) return [100];
  const maxScore = Math.max(...scores);
  const weights = scores.map((score) => Math.exp((score - maxScore) / RECOMMENDATION_SHARE_TEMPERATURE));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * 100);
  const result = exact.map(Math.floor);
  let remaining = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remaining; i += 1) result[order[i % order.length].index] += 1;
  return result;
}

function buildRecommendationContext(players: PlayerRanking[], picks: DraftPick[], config: DraftConfig, currentOverallPick: number): RecommendationContext {
  const selectionPick = nextUserOverallPick(currentOverallPick, config);
  const proposedReturnPick = followingUserOverallPick(currentOverallPick, config);
  const draftEnd = config.teamCount * totalRosterSlots(config);
  const returnPick = proposedReturnPick > draftEnd ? null : proposedReturnPick;
  const playerById = new Map(players.map((player) => [player.id, player]));
  const picksBySlot = new Map<number, DraftPick[]>();
  for (const pick of picks) {
    const list = picksBySlot.get(pick.draftSlot) ?? [];
    list.push(pick);
    picksBySlot.set(pick.draftSlot, list);
  }
  const rosterBySlot = new Map<number, PlayerRanking[]>();
  for (let slot = 1; slot <= config.teamCount; slot += 1) {
    rosterBySlot.set(slot, (picksBySlot.get(slot) ?? []).map((pick) => playerById.get(pick.playerId)).filter((player): player is PlayerRanking => Boolean(player)));
  }
  const opportunities = returnPick == null ? [] : opponentPickOpportunities(selectionPick, returnPick, config.teamCount, config.userDraftSlot);
  return {
    players,
    picks,
    config,
    currentOverallPick,
    selectionPick,
    returnPick,
    draftEnd,
    playerById,
    picksBySlot,
    rosterBySlot,
    userRoster: rosterBySlot.get(config.userDraftSlot) ?? [],
    trends: buildPositionTrends(picks, players, currentOverallPick),
    opportunities,
    uniqueOpponentSlots: [...new Set(opportunities)],
  };
}

function futureAvailabilityWithContext(player: PlayerRanking, available: PlayerRanking[], context: RecommendationContext): FutureAvailabilityResult {
  const trend = context.trends[player.position];
  if (context.returnPick == null) {
    return { urgency: 50, selectionPick: context.selectionPick, returnPick: null, interveningPicks: 0, uniqueOpponentTeams: 0, strongNeedTeams: 0, demandScore: 0, recentRunCount: trend.recentCount, label: 'FINAL_PICK' };
  }

  let strongNeedTeams = 0;
  let totalNeed = 0;
  for (const slot of context.uniqueOpponentSlots) {
    const roster = context.rosterBySlot.get(slot) ?? [];
    const need = positionNeedScore(player.position, roster, context.config);
    const opportunityCount = context.opportunities.filter((candidate) => candidate === slot).length;
    const adjustedNeed = clamp(need + Math.max(0, opportunityCount - 1) * 8, 0, 100);
    totalNeed += adjustedNeed;
    if (need >= 80) strongNeedTeams += 1;
  }
  const demandScore = context.uniqueOpponentSlots.length ? totalNeed / context.uniqueOpponentSlots.length : 0;
  const rankPressure = clamp(50 + (context.returnPick - player.overallRank) * 4, 5, 95);
  const adpPressure = player.adp == null ? rankPressure : clamp(50 + (context.returnPick - player.adp) * 4, 5, 95);
  const urgency = clamp(rankPressure * 0.35 + adpPressure * 0.15 + demandScore * 0.30 + trendPressure(trend) * 0.12 + tierUrgency(player, available) * 0.08, 0, 100);
  return {
    urgency,
    selectionPick: context.selectionPick,
    returnPick: context.returnPick,
    interveningPicks: context.opportunities.length,
    uniqueOpponentTeams: context.uniqueOpponentSlots.length,
    strongNeedTeams,
    demandScore,
    recentRunCount: trend.recentCount,
    label: urgency >= 68 ? 'UNLIKELY' : urgency >= 42 ? 'UNCERTAIN' : 'LIKELY',
  };
}

function rankingValue(rank: number): number {
  if (rank <= 1) return 100;
  return clamp(100 * Math.pow(0.5, (rank - 1) / RANKING_VALUE_HALF_LIFE), 0, 100);
}

function rosterFit(position: Position, roster: PlayerRanking[], config: DraftConfig, trends: Record<Position, PositionTrend>): number {
  const counts = positionCounts(roster);
  if (position === 'K' || position === 'DST') {
    const target = position === 'K' ? config.kStarters : config.dstStarters;
    if (target <= 0 || counts[position] >= target) return target <= 0 ? 0 : 5;
    const lateThreshold = totalRosterSlots(config) - config.dstStarters - config.kStarters;
    if (roster.length >= lateThreshold) return 88;
    if (position === 'DST') {
      if (trends.DST.status === 'HOT') return 72;
      if (trends.DST.status === 'DEVELOPING') return 36;
    }
    return 10;
  }
  const starterTarget: Partial<Record<Position, number>> = { QB: config.qbStarters, RB: config.rbStarters, WR: config.wrStarters, TE: config.teStarters };
  if (counts[position] < (starterTarget[position] ?? 0)) return 100;
  if ((position === 'RB' || position === 'WR' || position === 'TE') && config.flexStarters > 0 && baseSkillStarterDeficit(counts, config) === 0) {
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const base = config.rbStarters + config.wrStarters + config.teStarters;
    if (flexEligible < base + config.flexStarters) return position === 'WR' ? 86 : position === 'RB' ? 84 : 65;
  }
  if (position === 'WR') { const depth = Math.max(0, counts.WR - config.wrStarters); return depth <= 1 ? 74 : depth === 2 ? 66 : depth === 3 ? 58 : 44; }
  if (position === 'RB') { const depth = Math.max(0, counts.RB - config.rbStarters); return depth <= 1 ? 70 : depth === 2 ? 62 : depth === 3 ? 54 : 40; }
  if (position === 'TE') return 35;
  return 25;
}

function positionNeedScore(position: Position, roster: PlayerRanking[], config: DraftConfig): number {
  const counts = positionCounts(roster);
  const rosterLength = roster.length;
  const lateThreshold = totalRosterSlots(config) - config.dstStarters - config.kStarters;
  if (position === 'QB') return counts.QB < config.qbStarters ? 65 : counts.QB === config.qbStarters ? 12 : 2;
  if (position === 'DST') return counts.DST < config.dstStarters && rosterLength >= lateThreshold - 2 ? 82 : 8;
  if (position === 'K') return counts.K < config.kStarters && rosterLength >= lateThreshold - 1 ? 82 : 5;
  const starterTarget = position === 'RB' ? config.rbStarters : position === 'WR' ? config.wrStarters : config.teStarters;
  if (counts[position] < starterTarget) return position === 'TE' ? 72 : 100;
  const flexEligible = counts.RB + counts.WR + counts.TE;
  const flexTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  if (baseSkillStarterDeficit(counts, config) === 0 && flexEligible < flexTarget) return position === 'TE' ? 68 : position === 'WR' ? 84 : 82;
  const depth = Math.max(0, counts[position] - starterTarget);
  if (position === 'WR') return depth === 0 ? 60 : depth === 1 ? 46 : depth === 2 ? 32 : 15;
  if (position === 'RB') return depth === 0 ? 56 : depth === 1 ? 42 : depth === 2 ? 28 : 12;
  return depth === 0 ? 24 : 8;
}

function positionCounts(roster: PlayerRanking[]): Record<Position, number> {
  return roster.reduce<Record<Position, number>>((acc, player) => { acc[player.position] += 1; return acc; }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });
}
function baseSkillStarterDeficit(counts: Record<Position, number>, config: DraftConfig): number { return Math.max(0, config.rbStarters - counts.RB) + Math.max(0, config.wrStarters - counts.WR) + Math.max(0, config.teStarters - counts.TE); }

function mandatoryPositions(roster: PlayerRanking[], config: DraftConfig): Set<Position> {
  const counts = positionCounts(roster);
  const remainingSlots = Math.max(0, totalRosterSlots(config) - roster.length);
  const fixed: Array<[Position, number]> = [['QB', Math.max(0, config.qbStarters - counts.QB)], ['RB', Math.max(0, config.rbStarters - counts.RB)], ['WR', Math.max(0, config.wrStarters - counts.WR)], ['TE', Math.max(0, config.teStarters - counts.TE)], ['DST', Math.max(0, config.dstStarters - counts.DST)], ['K', Math.max(0, config.kStarters - counts.K)]];
  const fixedSkillDeficit = fixed.filter(([position]) => position === 'RB' || position === 'WR' || position === 'TE').reduce((sum, [, deficit]) => sum + deficit, 0);
  const totalSkillTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  const extraFlexDeficit = Math.max(0, Math.max(0, totalSkillTarget - (counts.RB + counts.WR + counts.TE)) - fixedSkillDeficit);
  const minimumRequired = fixed.reduce((sum, [, deficit]) => sum + deficit, 0) + extraFlexDeficit;
  if (remainingSlots > minimumRequired || minimumRequired === 0) return new Set<Position>();
  const required = new Set<Position>();
  for (const [position, deficit] of fixed) if (deficit > 0) required.add(position);
  if (extraFlexDeficit > 0) { required.add('RB'); required.add('WR'); required.add('TE'); }
  return required;
}

function totalRosterSlots(config: DraftConfig): number { return config.qbStarters + config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters + config.dstStarters + config.kStarters + config.benchSpots; }

function favoriteFit(player: PlayerRanking, selectionPick: number, isFavorite: boolean): number {
  if (!isFavorite) return 50;
  const gap = selectionPick - player.overallRank;
  if (gap >= 10) return 100;
  if (gap >= 5) return 92;
  if (gap >= 0) return 84;
  if (gap >= -5) return 74;
  if (gap >= -10) return 60;
  return 51;
}

function favoriteScoreAdjustment(player: PlayerRanking, fit: number, selectionPick: number, config: DraftConfig): number {
  if (fit <= 50) return 0;
  const strategy = config.draftStrategy ?? 'BALANCED';
  const round = roundForOverallPick(selectionPick, config.teamCount);
  const marketFall = player.adp == null ? 0 : selectionPick - player.adp;
  const rankingFall = selectionPick - player.overallRank;
  const conflict = (strategy === 'LATE_QB' && player.position === 'QB' && round < 7) || (strategy === 'ZERO_RB' && player.position === 'RB' && round <= 5);
  if (conflict && marketFall < 7 && rankingFall < 10) return 0;
  return ((fit - 50) / 50) * FAVORITE_MAX_ADJUSTMENT;
}

function strategyFit(player: PlayerRanking, roster: PlayerRanking[], config: DraftConfig, selectionPick: number): number {
  const strategy = config.draftStrategy ?? 'BALANCED';
  if (strategy === 'BALANCED') return 50;
  const counts = positionCounts(roster);
  const round = roundForOverallPick(selectionPick, config.teamCount);
  if (strategy === 'HERO_RB') { if (counts.RB === 0) return player.position === 'RB' ? 100 : player.position === 'WR' ? 65 : 50; if (round <= 6) return player.position === 'RB' ? 25 : player.position === 'WR' ? 90 : player.position === 'TE' ? 65 : 50; return player.position === 'RB' ? 70 : player.position === 'WR' ? 75 : 50; }
  if (strategy === 'ZERO_RB') { if (round <= 5) { if (player.position === 'RB') return 10; if (player.position === 'WR') return 100; if (player.position === 'TE') return 82; return 55; } if (player.position === 'RB') return counts.RB < config.rbStarters ? 100 : 78; return player.position === 'WR' ? 72 : 50; }
  if (strategy === 'ROBUST_RB') { if (round <= 5 && counts.RB < 3) return player.position === 'RB' ? 100 : player.position === 'WR' ? 55 : 45; return player.position === 'WR' ? 82 : player.position === 'RB' ? 45 : 50; }
  if (strategy === 'WR_HEAVY') { if (counts.WR < Math.max(config.wrStarters + 1, 4)) return player.position === 'WR' ? 100 : player.position === 'RB' ? 58 : 48; return player.position === 'WR' ? 72 : player.position === 'RB' ? 65 : 50; }
  if (strategy === 'LATE_QB') { if (player.position === 'QB') { if (counts.QB > 0) return 20; return round < 7 ? 5 : 100; } return round < 7 ? 70 : 50; }
  if (strategy === 'ELITE_TE') { if (counts.TE === 0 && player.position === 'TE') return player.tier != null && player.tier <= 2 ? 100 : 65; if (player.position === 'TE' && counts.TE > 0) return 20; return 60; }
  if (strategy === 'UPSIDE_HEAVY') { const upside = player.sourceMetadata?.upsideRating; return upside == null ? 50 : clamp(20 + (upside - 1) * 20, 20, 100); }
  return 50;
}

function strategyLabel(strategy: DraftStrategy): string { return ({ BALANCED: 'Balanced', HERO_RB: 'Hero RB', ZERO_RB: 'Zero RB', ROBUST_RB: 'Robust RB', WR_HEAVY: 'WR Heavy', LATE_QB: 'Late QB', ELITE_TE: 'Elite TE', UPSIDE_HEAVY: 'Upside Heavy' } as Record<DraftStrategy, string>)[strategy]; }

function tierUrgency(player: PlayerRanking, available: PlayerRanking[]): number {
  if (player.tier == null) return 50;
  const tiers = available.filter((candidate) => candidate.position === player.position && candidate.tier != null).map((candidate) => candidate.tier as number);
  if (!tiers.length) return 50;
  const best = Math.min(...tiers);
  if (player.tier !== best) return 20;
  const peers = available.filter((candidate) => candidate.position === player.position && candidate.tier === player.tier).length;
  return peers === 1 ? 100 : peers === 2 ? 88 : peers <= 4 ? 72 : 50;
}
function valueAtPick(player: PlayerRanking, selectionPick: number): number { return clamp(50 + (selectionPick - player.overallRank) * 2.5, 10, 100); }
function byeWeekFit(player: PlayerRanking, roster: PlayerRanking[]): number { if (player.byeWeek == null) return 50; const same = roster.filter((existing) => existing.byeWeek === player.byeWeek); if (player.position === 'QB' && same.some((existing) => existing.position === 'QB')) return 15; if (player.position === 'TE' && same.some((existing) => existing.position === 'TE')) return 25; return same.length === 0 ? 100 : same.length === 1 ? 82 : same.length === 2 ? 58 : same.length === 3 ? 35 : 15; }

function earlyRoundRankPenalty(player: PlayerRanking, selectionPick: number, config: DraftConfig, isFavorite: boolean): number {
  const round = roundForOverallPick(selectionPick, config.teamCount);
  if (round > 3) return 0;
  const reach = player.overallRank - selectionPick;
  if (reach <= 2) return 0;
  let penalty = reach <= 5 ? (reach - 2) * 1.5 : 4.5 + (reach - 5) * 1.8;
  if (isFavorite) penalty *= 0.75;
  return Math.min(12, penalty);
}

function buildReasons(item: ScoredCandidate, available: PlayerRanking[], context: RecommendationContext): string[] {
  const { player, breakdown, availability, isFavorite } = item;
  const reasons: string[] = [];
  const valueGap = context.selectionPick - player.overallRank;
  if (availability.label === 'UNLIKELY' && availability.returnPick != null) reasons.push(`Unlikely to make it back to pick #${availability.returnPick}`);
  else if (availability.label === 'LIKELY' && availability.returnPick != null && availability.interveningPicks >= 4) reasons.push(`Reasonable chance to survive to pick #${availability.returnPick}`);
  if (item.marketFall != null && item.marketFall >= 5) reasons.push(`${Math.round(item.marketFall)} picks past estimated market ADP`);
  if (availability.strongNeedTeams >= 2) reasons.push(`${availability.strongNeedTeams} teams before your next turn show strong ${player.position} need`);
  const strategy = context.config.draftStrategy ?? 'BALANCED';
  if (breakdown.strategyFit >= 85 && strategy !== 'BALANCED') reasons.push(`Strong fit for ${strategyLabel(strategy)} strategy`);
  if (isFavorite && breakdown.favoriteFit >= 55) {
    if (valueGap >= 5) reasons.push(`Favorite who has fallen ${valueGap} picks past your ranking`);
    else if (valueGap >= 0) reasons.push('Favorite available at or after your ranking');
    else reasons.push(`Favorite within ${Math.abs(valueGap)} picks of your ranking`);
  }
  if (item.positionTrend === 'HOT') reasons.push(`${player.position} run is hot in the last six picks`);
  else if (item.positionTrend === 'DEVELOPING') reasons.push(`${player.position} run is developing`);
  if (valueGap >= 5) reasons.push(`${valueGap} picks of ranking value at your selection`);
  if (breakdown.rosterFit >= 90) reasons.push(`Fills a priority ${player.position} starter slot`);
  if (player.tier != null) { const peers = available.filter((candidate) => candidate.position === player.position && candidate.tier === player.tier).length; if (peers === 1) reasons.push(`Final ${player.position} remaining in Tier ${player.tier}`); else if (peers <= 3) reasons.push(`Only ${peers} ${player.position}s remain in Tier ${player.tier}`); }
  if (breakdown.rankingValue >= 85) reasons.push('Among the strongest remaining values in your rankings');
  if (!reasons.length) reasons.push('Balanced combination of ranking value and roster fit');
  return reasons.slice(0, 3);
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
