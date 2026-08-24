import { recommendPlayers, relativeRecommendationPercents } from './recommendation';
import { roundForOverallPick } from './draft';
import { opponentHistoryAvailabilitySignal } from './opponent-model';
import { survivalProbabilityForPlayer } from './survival';
import type { AvailabilityLabel, DraftConfig, DraftPick, PlayerRanking, Recommendation } from './types';

/**
 * On-clock recommendation wrapper. The underlying engine remains the source of
 * factor scores, while this layer enforces extra early-round rank discipline,
 * reports market falls only after they actually occur, uses the calibrated
 * direct-survival model when the candidate is inside its validated domain, and
 * applies the bounded Purple League V1 history signal only as a tie-breaker.
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
  const candidates = recommendPlayers({
    players,
    picks,
    config,
    currentOverallPick,
    favoritePlayerIds,
    limit: Math.max(12, limit * 4),
  });
  const round = roundForOverallPick(currentOverallPick, config.teamCount);

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
    const rawScore = item.rawScore - earlyRankPenalty - tierDamping + availabilityScoreAdjustment;

    const actualMarketFall = item.player.adp == null
      ? undefined
      : Math.round((currentOverallPick - item.player.adp) * 10) / 10;
    const marketFall = actualMarketFall != null && actualMarketFall >= 3 ? actualMarketFall : undefined;
    const reasons = item.reasons
      .filter((reason) => !reason.includes('past estimated market ADP'))
      .filter((reason) => !reason.startsWith('Favorite who has fallen'));
    if (history.reasons.length) reasons.unshift(history.reasons[0]);
    if (marketFall != null && marketFall >= 5) reasons.unshift(`${Math.round(marketFall)} picks past estimated market ADP`);

    return {
      ...item,
      rawScore,
      marketFall,
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

function availabilityLabel(existing: AvailabilityLabel, urgency: number): AvailabilityLabel {
  if (existing === 'FINAL_PICK') return existing;
  if (urgency >= 68) return 'UNLIKELY';
  if (urgency >= 42) return 'UNCERTAIN';
  return 'LIKELY';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
