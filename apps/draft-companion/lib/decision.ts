import { offseasonContextSignalForPlayer } from './context-signal';
import { recommendPlayers, relativeRecommendationPercents } from './recommendation';
import { roundForOverallPick } from './draft';
import { opponentHistoryAvailabilitySignal } from './opponent-model';
import { survivalProbabilityForPlayer } from './survival';
import type { AvailabilityLabel, DraftConfig, DraftPick, PlayerRanking, Recommendation } from './types';

/**
 * On-clock recommendation wrapper. The underlying engine remains the source of
 * factor scores, while this layer enforces extra early-round rank discipline,
 * reports market falls only after they actually occur, uses the calibrated
 * direct-survival model when the candidate is inside its validated domain,
 * applies the bounded Purple League V1 history signal only as a tie-breaker,
 * applies curated offseason context as a final bounded close-call signal, and
 * suppresses ordinary QB2 selections in shallow one-QB formats while preserving
 * an escape hatch for exceptional draft-day value.
 */
export function recommendForCurrentPick(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  favoritePlayerIds?: readonly string[];
  managerIds?: readonly string[];
  teamNames?: readonly string[];
  limit?: number;
}): Recommendation[] {
  const { players, picks, config, currentOverallPick, favoritePlayerIds = [], managerIds = [], teamNames = [], limit = 3 } = args;
  const favoriteIds = new Set(favoritePlayerIds);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const userRoster = picks
    .filter((pick) => pick.draftSlot === config.userDraftSlot)
    .map((pick) => playerById.get(pick.playerId))
    .filter((player): player is PlayerRanking => Boolean(player));
  const candidates = recommendPlayers({
    players,
    picks,
    config,
    currentOverallPick,
    favoritePlayerIds,
    limit: Math.max(12, limit * 4),
  });
  const round = roundForOverallPick(currentOverallPick, config.teamCount);
  const rankingAnchor = candidates.reduce<Recommendation | undefined>(
    (best, candidate) => !best || candidate.player.overallRank < best.player.overallRank ? candidate : best,
    undefined,
  );

  const rescored = candidates.map((item) => {
    const reach = item.player.overallRank - currentOverallPick;
    const earlyRankPenalty = round <= 2 && reach > 2
      ? Math.min(10, (reach - 2) * 1.5) * (favoriteIds.has(item.player.id) ? 0.75 : 1)
      : 0;
    const tierDamping = round <= 2 ? (item.breakdown.tierUrgency - 50) * 0.1125 : 0;

    const survival = survivalProbabilityForPlayer({
      player: item.player,
      players,
      picks,
      config,
      currentOverallPick,
    });
    const calibratedAvailabilityUrgency = survival
      ? (1 - survival.probability) * 100
      : item.breakdown.futureAvailability;

    const history = opponentHistoryAvailabilitySignal({
      player: item.player,
      config,
      currentOverallPick,
      managerIds,
      teamNames,
    });
    const futureAvailability = clamp(calibratedAvailabilityUrgency + history.adjustment, 0, 100);
    const availabilityScoreAdjustment = (futureAvailability - item.breakdown.futureAvailability) * 0.05;
    const context = offseasonContextSignalForPlayer({
      player: item.player,
      bestCandidateRank: rankingAnchor?.player.overallRank ?? item.player.overallRank,
      bestCandidateTier: rankingAnchor?.player.tier,
      selectionPick: currentOverallPick,
      teamCount: config.teamCount,
    });
    const qb2Penalty = backupQbRosterPenalty(item.player, userRoster, config, currentOverallPick);
    const rawScore = item.rawScore
      - earlyRankPenalty
      - tierDamping
      - qb2Penalty
      + availabilityScoreAdjustment
      + context.adjustment;

    const actualMarketFall = item.player.adp == null
      ? undefined
      : Math.round((currentOverallPick - item.player.adp) * 10) / 10;
    const marketFall = actualMarketFall != null && actualMarketFall >= 3 ? actualMarketFall : undefined;
    const reasons = item.reasons
      .filter((reason) => !reason.includes('past estimated market ADP'))
      .filter((reason) => !reason.startsWith('Favorite who has fallen'));
    if (history.reasons.length) reasons.unshift(history.reasons[0]);
    if (marketFall != null && marketFall >= 5) reasons.unshift(`${Math.round(marketFall)} picks past estimated market ADP`);
    if (context.reason) reasons.unshift(context.reason);
    if (qb2Penalty > 0) reasons.unshift('QB2 carries a roster-cost penalty in this 1-QB format');

    return {
      ...item,
      rawScore,
      marketFall,
      contextAdjustment: context.adjustment,
      survivalProbability: survival?.probability,
      availabilityLabel: availabilityLabel(item.availabilityLabel, futureAvailability),
      breakdown: { ...item.breakdown, futureAvailability },
      reasons: reasons.slice(0, 3),
    };
  });

  const top = rescored
    .sort((a, b) => b.rawScore - a.rawScore || a.player.overallRank - b.player.overallRank)
    .slice(0, limit);
  const shares = relativeRecommendationPercents(top.map((item) => item.rawScore));
  return top.map((item, index) => ({ ...item, recommendationPercent: shares[index] ?? 0 }));
}

/**
 * Bounded roster-cost penalty for carrying a second quarterback in a one-QB
 * league. The rule is intentionally not a ban: a truly exceptional ECR/ADP
 * fall can still overcome a small residual penalty. Missing RB/WR/TE/FLEX
 * starters make QB2 especially expensive because the bench slot has a much
 * higher opportunity cost.
 */
export function backupQbRosterPenalty(
  player: PlayerRanking,
  roster: readonly PlayerRanking[],
  config: DraftConfig,
  selectionPick: number,
): number {
  if (player.position !== 'QB' || config.qbStarters !== 1) return 0;
  const counts = positionCounts(roster);
  if (counts.QB < 1) return 0;

  const baseSkillDeficit = Math.max(0, config.rbStarters - counts.RB)
    + Math.max(0, config.wrStarters - counts.WR)
    + Math.max(0, config.teStarters - counts.TE);
  const flexTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  const flexIncomplete = counts.RB + counts.WR + counts.TE < flexTarget;
  if (baseSkillDeficit > 0 || flexIncomplete) return 12;

  const rankingFall = selectionPick - player.overallRank;
  const marketFall = player.adp == null ? rankingFall : selectionPick - player.adp;
  const bestValueFall = Math.max(rankingFall, marketFall);
  if (bestValueFall >= 20) return 2;
  if (bestValueFall >= 12) return 5;
  if (bestValueFall >= 8) return 7;
  return 10;
}

function positionCounts(roster: readonly PlayerRanking[]): Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST', number> {
  return roster.reduce<Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST', number>>((counts, player) => {
    counts[player.position] += 1;
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });
}

function availabilityLabel(existing: AvailabilityLabel, urgency: number): AvailabilityLabel {
  if (existing === 'FINAL_PICK') return existing;
  if (urgency >= 68) return 'UNLIKELY';
  if (urgency >= 42) return 'UNCERTAIN';
  return 'LIKELY';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}