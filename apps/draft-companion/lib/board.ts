import type { DraftConfig, DraftPick, PlayerRanking } from './types';
import { overallPickForRoundAndSlot } from './draft';

export interface DraftBoardCell {
  round: number;
  draftSlot: number;
  overallPick: number;
  pick?: DraftPick;
  player?: PlayerRanking;
}

export function rosterSize(config: DraftConfig): number {
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

export function totalDraftPicks(config: DraftConfig): number {
  return config.teamCount * rosterSize(config);
}

export function nextOpenOverallPick(picks: DraftPick[], config: DraftConfig): number | null {
  const occupied = new Set(picks.map((pick) => pick.overallPick));
  const total = totalDraftPicks(config);
  for (let overallPick = 1; overallPick <= total; overallPick += 1) {
    if (!occupied.has(overallPick)) return overallPick;
  }
  return null;
}

export function isDraftComplete(picks: DraftPick[], config: DraftConfig): boolean {
  return nextOpenOverallPick(picks, config) == null;
}

export function buildDraftBoard(
  config: DraftConfig,
  picks: DraftPick[],
  players: PlayerRanking[],
): DraftBoardCell[][] {
  const pickByOverall = new Map(picks.map((pick) => [pick.overallPick, pick]));
  const playerById = new Map(players.map((player) => [player.id, player]));

  return Array.from({ length: rosterSize(config) }, (_, roundIndex) => {
    const round = roundIndex + 1;
    return Array.from({ length: config.teamCount }, (_, slotIndex) => {
      const draftSlot = slotIndex + 1;
      const overallPick = overallPickForRoundAndSlot(round, draftSlot, config.teamCount);
      const pick = pickByOverall.get(overallPick);
      return {
        round,
        draftSlot,
        overallPick,
        pick,
        player: pick ? playerById.get(pick.playerId) : undefined,
      };
    });
  });
}

export function rosterForSlot(
  draftSlot: number,
  picks: DraftPick[],
  players: PlayerRanking[],
): PlayerRanking[] {
  const playerById = new Map(players.map((player) => [player.id, player]));
  return picks
    .filter((pick) => pick.draftSlot === draftSlot)
    .sort((a, b) => a.overallPick - b.overallPick)
    .map((pick) => playerById.get(pick.playerId))
    .filter((player): player is PlayerRanking => Boolean(player));
}
