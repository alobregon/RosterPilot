import { totalDraftPicks } from './board';
import type { DraftConfig, PlayerRanking, Position } from './types';

export interface DraftPreflightResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateRankingPool(players: PlayerRanking[], config: DraftConfig): DraftPreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const totalPicks = totalDraftPicks(config);

  if (players.length < totalPicks) {
    errors.push(`Rankings contain ${players.length} players, but this draft requires ${totalPicks} total picks.`);
  }

  const uniqueIds = new Set(players.map((player) => player.id));
  if (uniqueIds.size !== players.length) errors.push('Rankings contain duplicate player IDs.');

  const counts = countPositions(players);
  const fixedTargets: Array<[Position, number]> = [
    ['QB', config.qbStarters], ['RB', config.rbStarters], ['WR', config.wrStarters],
    ['TE', config.teStarters], ['DST', config.dstStarters], ['K', config.kStarters],
  ];
  for (const [position, target] of fixedTargets) {
    if (target > 0 && counts[position] < target) {
      errors.push(`Rankings need at least ${target} ${position}${target === 1 ? '' : 's'} to fill your required roster.`);
    }
  }

  const skillTarget = config.rbStarters + config.wrStarters + config.teStarters + config.flexStarters;
  if (counts.RB + counts.WR + counts.TE < skillTarget) {
    errors.push(`Rankings need at least ${skillTarget} FLEX-eligible RB/WR/TE players.`);
  }

  if (players.some((player) => player.overallRank > players.length * 2)) {
    warnings.push('Rankings contain large rank gaps; verify the imported overall-rank column.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function countPositions(players: PlayerRanking[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const player of players) counts[player.position] += 1;
  return counts;
}
