import { draftSlotForOverallPick, pickInRound, roundForOverallPick } from './draft';
import type { DraftPick } from './types';

export function draftPickAtOverall(
  overallPick: number,
  playerId: string,
  teamCount: number,
): DraftPick {
  return {
    overallPick,
    round: roundForOverallPick(overallPick, teamCount),
    pickInRound: pickInRound(overallPick, teamCount),
    draftSlot: draftSlotForOverallPick(overallPick, teamCount),
    playerId,
  };
}

export function replaceDraftPick(
  picks: DraftPick[],
  overallPick: number,
  playerId: string,
  teamCount: number,
): DraftPick[] {
  const replacement = draftPickAtOverall(overallPick, playerId, teamCount);
  return [...picks.filter((pick) => pick.overallPick !== overallPick), replacement]
    .sort((a, b) => a.overallPick - b.overallPick);
}

export function removeDraftPick(picks: DraftPick[], overallPick: number): DraftPick[] {
  return picks.filter((pick) => pick.overallPick !== overallPick);
}
