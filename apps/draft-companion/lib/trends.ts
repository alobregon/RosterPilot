import type { DraftPick, PlayerRanking, Position, PositionTrendStatus } from './types';

export interface PositionTrend {
  position: Position;
  status: PositionTrendStatus;
  recentCount: number;
  previousCount: number;
  delta: number;
  windowSize: number;
}

const WINDOW = 6;

export function buildPositionTrends(
  picks: readonly DraftPick[],
  players: readonly PlayerRanking[],
  currentOverallPick: number,
): Record<Position, PositionTrend> {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const completed = picks
    .filter((pick) => pick.overallPick < currentOverallPick)
    .sort((a, b) => a.overallPick - b.overallPick);
  const recent = completed.slice(-WINDOW);
  const previous = completed.slice(-(WINDOW * 2), -WINDOW);
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

  return Object.fromEntries(
    positions.map((position) => {
      const recentCount = countPosition(recent, playerById, position);
      const previousCount = countPosition(previous, playerById, position);
      const delta = recentCount - previousCount;
      return [position, {
        position,
        status: classifyTrend(position, recentCount, previousCount),
        recentCount,
        previousCount,
        delta,
        windowSize: recent.length,
      }];
    }),
  ) as Record<Position, PositionTrend>;
}

export function trendPressure(trend: PositionTrend): number {
  if (trend.status === 'HOT') return 100;
  if (trend.status === 'DEVELOPING') return 62;
  return 10;
}

function classifyTrend(position: Position, recentCount: number, previousCount: number): PositionTrendStatus {
  const hotFloor = position === 'DST' ? 2 : position === 'RB' || position === 'WR' ? 3 : 2;
  if (recentCount >= hotFloor && recentCount >= previousCount + 2) return 'HOT';
  // A single selection is normal draft activity, not a positional run. Require
  // at least two recent selections before escalating to DEVELOPING.
  const developingFloor = Math.max(2, hotFloor - 1);
  if (recentCount >= developingFloor && recentCount > previousCount) return 'DEVELOPING';
  return 'QUIET';
}

function countPosition(
  picks: readonly DraftPick[],
  playerById: Map<string, PlayerRanking>,
  position: Position,
): number {
  return picks.reduce((count, pick) => count + (playerById.get(pick.playerId)?.position === position ? 1 : 0), 0);
}
