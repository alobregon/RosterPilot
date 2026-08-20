import { isDraftComplete, nextOpenOverallPick, totalDraftPicks } from './board';
import { draftSlotForOverallPick, pickInRound, roundForOverallPick } from './draft';
import type { DraftConfig, DraftPick } from './types';

export interface DraftSessionState {
  complete: boolean;
  totalPicks: number;
  currentOverallPick: number;
  currentRound: number;
  currentPickInRound: number;
  currentSlot: number | null;
  historicalGap: boolean;
}

export function deriveDraftSession(
  picks: DraftPick[],
  config: DraftConfig,
  draftStarted: boolean,
): DraftSessionState {
  const totalPicks = totalDraftPicks(config);
  const complete = draftStarted && isDraftComplete(picks, config);
  const nextOpen = nextOpenOverallPick(picks, config);
  const currentOverallPick = complete ? totalPicks : nextOpen ?? totalPicks;
  const historicalGap = Boolean(
    draftStarted && nextOpen != null && picks.some((pick) => pick.overallPick > nextOpen),
  );
  return {
    complete,
    totalPicks,
    currentOverallPick,
    currentRound: roundForOverallPick(Math.max(1, currentOverallPick), config.teamCount),
    currentPickInRound: pickInRound(Math.max(1, currentOverallPick), config.teamCount),
    currentSlot: !draftStarted || complete ? null : draftSlotForOverallPick(currentOverallPick, config.teamCount),
    historicalGap,
  };
}
