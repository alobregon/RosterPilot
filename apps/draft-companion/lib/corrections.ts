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

/**
 * Simulator undo is a user-decision undo rather than a literal one-pick undo.
 * Opponent picks after the user's most recent choice were generated from that
 * choice, so remove the user pick and every downstream simulated pick. This
 * returns the draft to that same user turn and prevents the simulator effect
 * from immediately recreating an opponent pick that was just removed.
 *
 * Before the user has made any selection there is no user decision to undo,
 * so leave the simulated opening intact.
 */
export function undoLatestSimulatorUserDecision(
  picks: DraftPick[],
  userDraftSlot: number,
): DraftPick[] {
  const latestUserPick = [...picks]
    .filter((pick) => pick.draftSlot === userDraftSlot)
    .sort((a, b) => b.overallPick - a.overallPick)[0];

  if (!latestUserPick) return picks;
  return picks
    .filter((pick) => pick.overallPick < latestUserPick.overallPick)
    .sort((a, b) => a.overallPick - b.overallPick);
}
