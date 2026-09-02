import { nextUserOverallPick } from './draft';
import { buildPositionTrends } from './trends';
import type { DraftConfig, DraftPick, PlayerRanking, PositionTrendStatus } from './types';

export type TargetAvailabilityLabel = 'LIKELY' | 'POSSIBLE' | 'LONG_SHOT';

export interface UpcomingTarget {
  player: PlayerRanking;
  targetPick: number;
  availabilityPercent: number;
  availabilityLabel: TargetAvailabilityLabel;
  marketPick: number;
  reasons: string[];
}

const MARKET_SCALE = 3;
const MIN_REALISTIC_TARGET_PERCENT = 35;

export function projectUpcomingTargets(args: {
  players: PlayerRanking[];
  picks: DraftPick[];
  config: DraftConfig;
  currentOverallPick: number;
  targetPick?: number;
  limit?: number;
}): UpcomingTarget[] {
  const { players, picks, config, currentOverallPick, limit = 3 } = args;
  if (limit <= 0) return [];

  const targetPick = args.targetPick ?? nextUserOverallPick(currentOverallPick, config);
  if (targetPick <= currentOverallPick) return [];

  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const trends = buildPositionTrends(picks, players, currentOverallPick);
  const candidates = players
    .filter((player) => !draftedIds.has(player.id))
    .map((player): UpcomingTarget => {
      const trend = trends[player.position].status;
      const marketPick = Math.max(1, blendedMarketPick(player) + trendMarketAdjustment(trend));
      const availabilityPercent = Math.round(conditionalAvailabilityPercent(marketPick, currentOverallPick, targetPick));
      return {
        player,
        targetPick,
        availabilityPercent,
        availabilityLabel: targetAvailabilityLabel(availabilityPercent),
        marketPick,
        reasons: buildTargetReasons(player, currentOverallPick, targetPick, availabilityPercent, trend),
      };
    });

  const realistic = candidates
    .filter((target) => target.availabilityPercent >= MIN_REALISTIC_TARGET_PERCENT)
    .sort(targetSort);

  if (realistic.length >= limit) return realistic.slice(0, limit);

  const selectedIds = new Set(realistic.map((target) => target.player.id));
  const fallback = candidates
    .filter((target) => !selectedIds.has(target.player.id))
    .sort((a, b) => b.availabilityPercent - a.availabilityPercent || a.player.overallRank - b.player.overallRank);

  return [...realistic, ...fallback].slice(0, limit);
}

export function conditionalAvailabilityPercent(marketPick: number, currentOverallPick: number, targetPick: number): number {
  if (targetPick <= currentOverallPick) return 100;
  const surviveToCurrent = survivalAtPick(marketPick, currentOverallPick);
  const surviveToTarget = survivalAtPick(marketPick, targetPick);
  if (surviveToCurrent <= 0.0001) return 0;
  return clamp((surviveToTarget / surviveToCurrent) * 100, 0, 100);
}

function survivalAtPick(marketPick: number, pick: number): number {
  return 1 / (1 + Math.exp((pick - marketPick) / MARKET_SCALE));
}

function blendedMarketPick(player: PlayerRanking): number {
  if (player.adp == null) return player.overallRank;
  return player.adp * 0.7 + player.overallRank * 0.3;
}

function targetAvailabilityLabel(percent: number): TargetAvailabilityLabel {
  if (percent >= 70) return 'LIKELY';
  if (percent >= 45) return 'POSSIBLE';
  return 'LONG_SHOT';
}

function targetSort(a: UpcomingTarget, b: UpcomingTarget): number {
  return a.player.overallRank - b.player.overallRank || b.availabilityPercent - a.availabilityPercent;
}

function trendMarketAdjustment(status: PositionTrendStatus): number {
  if (status === 'HOT') return -2;
  if (status === 'DEVELOPING') return -1;
  return 0;
}

function buildTargetReasons(
  player: PlayerRanking,
  currentOverallPick: number,
  targetPick: number,
  availabilityPercent: number,
  trend: PositionTrendStatus,
): string[] {
  const reasons = [
    `#${player.overallRank} on your rankings`,
    `Estimated ${availabilityPercent}% chance to reach pick #${targetPick}`,
  ];

  if (trend === 'HOT') reasons.push(`${player.position} run is hot; availability discounted`);
  else if (trend === 'DEVELOPING') reasons.push(`${player.position} run is developing`);
  else if (player.adp != null) {
    const actualFall = currentOverallPick - player.adp;
    if (actualFall >= 3) reasons.push(`${Math.round(actualFall)} picks past market ADP and still available`);
    else reasons.push(`Market ADP ${Math.round(player.adp)}`);
  }

  return reasons.slice(0, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
