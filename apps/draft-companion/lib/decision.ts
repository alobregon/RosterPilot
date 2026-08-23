import { recommendPlayers, relativeRecommendationPercents } from './recommendation';
import { roundForOverallPick } from './draft';
import type { DraftConfig, DraftPick, PlayerRanking, Recommendation } from './types';

/**
 * On-clock recommendation wrapper. The underlying engine remains the source of
 * factor scores, while this layer enforces extra early-round rank discipline
 * and reports a market fall only when it has actually occurred in the live draft.
 */
export function recommendForCurrentPick(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  favoritePlayerIds?: readonly string[];
  limit?: number;
}): Recommendation[] {
  const { players, picks, config, currentOverallPick, favoritePlayerIds = [], limit = 3 } = args;
  const favoriteIds = new Set(favoritePlayerIds);
  const candidates = recommendPlayers({ ...args, limit: Math.max(12, limit * 4) });
  const round = roundForOverallPick(currentOverallPick, config.teamCount);

  const rescored = candidates.map((item) => {
    const reach = item.player.overallRank - currentOverallPick;
    const earlyRankPenalty = round <= 2 && reach > 2
      ? Math.min(10, (reach - 2) * 1.5) * (favoriteIds.has(item.player.id) ? 0.75 : 1)
      : 0;
    const tierDamping = round <= 2 ? (item.breakdown.tierUrgency - 50) * 0.1125 : 0;
    const rawScore = item.rawScore - earlyRankPenalty - tierDamping;
    const actualMarketFall = item.player.adp == null
      ? undefined
      : Math.round((currentOverallPick - item.player.adp) * 10) / 10;
    const marketFall = actualMarketFall != null && actualMarketFall >= 3 ? actualMarketFall : undefined;
    const reasons = item.reasons
      .filter((reason) => !reason.includes('past estimated market ADP'))
      .filter((reason) => !reason.startsWith('Favorite who has fallen'));
    if (marketFall != null && marketFall >= 5) reasons.unshift(`${Math.round(marketFall)} picks past estimated market ADP`);
    return { ...item, rawScore, marketFall, reasons: reasons.slice(0, 3) };
  });

  const top = rescored
    .sort((a, b) => b.rawScore - a.rawScore || a.player.overallRank - b.player.overallRank)
    .slice(0, limit);
  const shares = relativeRecommendationPercents(top.map((item) => item.rawScore));
  return top.map((item, index) => ({ ...item, recommendationPercent: shares[index] ?? 0 }));
}
