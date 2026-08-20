import type {
  DraftConfig,
  DraftPick,
  PlayerRanking,
  Position,
  Recommendation,
  RecommendationBreakdown,
} from './types';
import { nextUserOverallPick, picksForSlot } from './draft';

const WEIGHTS = {
  rankingValue: 0.5,
  rosterFit: 0.2,
  tierUrgency: 0.15,
  valueAtPick: 0.15,
} as const;

const POSITION_RUN_WINDOW = 8;

export function recommendPlayers(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  limit?: number;
}): Recommendation[] {
  const { players, picks, config, currentOverallPick, limit = 3 } = args;
  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const available = players.filter((player) => !draftedIds.has(player.id));

  if (available.length === 0) return [];

  const maxRank = Math.max(...players.map((player) => player.overallRank));
  const userPicks = picksForSlot(picks, config.userDraftSlot);
  const userPlayerIds = new Set(userPicks.map((pick) => pick.playerId));
  const userRoster = players.filter((player) => userPlayerIds.has(player.id));
  const nextPick = nextUserOverallPick(currentOverallPick, config);

  return available
    .map((player) => {
      const breakdown: RecommendationBreakdown = {
        rankingValue: rankingValue(player.overallRank, maxRank),
        rosterFit: rosterFit(player.position, userRoster, config, {
          picks,
          players,
          currentOverallPick,
        }),
        tierUrgency: tierUrgency(player, available),
        valueAtPick: valueAtPick(player, nextPick),
      };

      const rawScore = clamp(
        breakdown.rankingValue * WEIGHTS.rankingValue +
          breakdown.rosterFit * WEIGHTS.rosterFit +
          breakdown.tierUrgency * WEIGHTS.tierUrgency +
          breakdown.valueAtPick * WEIGHTS.valueAtPick,
        0,
        100,
      );

      return {
        player,
        rawScore,
        strength: Math.round(55 + rawScore * 0.44),
        breakdown,
        reasons: buildReasons(player, breakdown, available, nextPick, {
          picks,
          players,
          currentOverallPick,
        }),
      } satisfies Recommendation;
    })
    .sort((a, b) => b.rawScore - a.rawScore || a.player.overallRank - b.player.overallRank)
    .slice(0, limit);
}

function rankingValue(rank: number, maxRank: number): number {
  if (maxRank <= 1) return 100;
  return clamp(100 * (1 - (rank - 1) / maxRank), 0, 100);
}

function rosterFit(
  position: Position,
  roster: PlayerRanking[],
  config: DraftConfig,
  draftContext: DraftTrendContext,
): number {
  const counts = roster.reduce<Record<Position, number>>(
    (acc, player) => {
      acc[player.position] += 1;
      return acc;
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );

  if (position === 'K' || position === 'DST') {
    const target = position === 'K' ? config.kStarters : config.dstStarters;
    if (target <= 0) return 0;
    if (counts[position] >= target) return 5;

    const totalRosterSlots =
      config.qbStarters +
      config.rbStarters +
      config.wrStarters +
      config.teStarters +
      config.flexStarters +
      config.dstStarters +
      config.kStarters +
      config.benchSpots;
    const specialStarterSlots = config.dstStarters + config.kStarters;
    const lateSpecialTeamsThreshold = Math.max(0, totalRosterSlots - specialStarterSlots);

    if (roster.length >= lateSpecialTeamsThreshold) return 88;

    // Kicker remains a deliberate final-round preference. DST is different:
    // if the room begins a genuine defense run, increase urgency without blindly
    // chasing a single early selection. Tier scarcity remains a separate factor.
    if (position === 'DST') {
      const run = recentPositionRun('DST', draftContext);
      if (run.count >= 4) return 72;
      if (run.count === 3) return 58;
      if (run.count === 2) return 36;
    }

    return 10;
  }

  const target: Partial<Record<Position, number>> = {
    QB: config.qbStarters,
    RB: config.rbStarters,
    WR: config.wrStarters,
    TE: config.teStarters,
  };

  const starterTarget = target[position] ?? 0;
  if (counts[position] < starterTarget) return 100;

  // FLEX is RB/WR/TE for this league. Once base starters at the candidate's
  // position are satisfied, preserve value for the open FLEX slot.
  if ((position === 'RB' || position === 'WR' || position === 'TE') && config.flexStarters > 0) {
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const baseFlexEligible = config.rbStarters + config.wrStarters + config.teStarters;
    if (flexEligible < baseFlexEligible + config.flexStarters) return 82;
  }

  if (position === 'RB' || position === 'WR') return 68;
  if (position === 'TE') return 52;
  return 42;
}

function tierUrgency(player: PlayerRanking, available: PlayerRanking[]): number {
  if (player.tier == null) return 50;

  const peers = available.filter(
    (candidate) => candidate.position === player.position && candidate.tier === player.tier,
  ).length;

  if (peers === 1) return 100;
  if (peers === 2) return 88;
  if (peers <= 4) return 72;
  return 50;
}

function valueAtPick(player: PlayerRanking, nextPick: number): number {
  const gap = nextPick - player.overallRank;
  return clamp(50 + gap * 2.5, 10, 100);
}

function buildReasons(
  player: PlayerRanking,
  breakdown: RecommendationBreakdown,
  available: PlayerRanking[],
  nextPick: number,
  draftContext: DraftTrendContext,
): string[] {
  const reasons: string[] = [];
  const valueGap = nextPick - player.overallRank;

  if (valueGap >= 5) reasons.push(`${valueGap} picks of ranking value at your next selection`);
  if (breakdown.rosterFit >= 90) reasons.push(`Fills a priority ${player.position} starter slot`);
  if ((player.position === 'K' || player.position === 'DST') && breakdown.rosterFit >= 80) {
    reasons.push(`Late-round ${player.position} starter slot is still open`);
  }

  if (player.position === 'DST') {
    const run = recentPositionRun('DST', draftContext);
    if (run.count >= 2 && breakdown.rosterFit < 80) {
      reasons.push(`${run.count} DSTs selected in the last ${run.windowSize} picks; defense run is developing`);
    }
  }

  if (player.tier != null) {
    const sameTierRemaining = available.filter(
      (candidate) => candidate.position === player.position && candidate.tier === player.tier,
    ).length;
    if (sameTierRemaining === 1) reasons.push(`Final ${player.position} remaining in Tier ${player.tier}`);
    else if (sameTierRemaining <= 3) reasons.push(`Only ${sameTierRemaining} ${player.position}s remain in Tier ${player.tier}`);
  }

  if (breakdown.rankingValue >= 85) reasons.push('Among the strongest remaining values in your rankings');
  if (reasons.length === 0) reasons.push('Balanced combination of ranking value and roster fit');

  return reasons.slice(0, 3);
}

interface DraftTrendContext {
  picks: DraftPick[];
  players: PlayerRanking[];
  currentOverallPick: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
