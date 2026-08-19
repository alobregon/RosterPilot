import type { DraftConfig, DraftPick } from './types';

export function roundForOverallPick(overallPick: number, teamCount: number): number {
  assertPositiveInteger(overallPick, 'overallPick');
  assertPositiveInteger(teamCount, 'teamCount');
  return Math.floor((overallPick - 1) / teamCount) + 1;
}

export function pickInRound(overallPick: number, teamCount: number): number {
  roundForOverallPick(overallPick, teamCount);
  return ((overallPick - 1) % teamCount) + 1;
}

export function draftSlotForOverallPick(overallPick: number, teamCount: number): number {
  const round = roundForOverallPick(overallPick, teamCount);
  const indexInRound = pickInRound(overallPick, teamCount);
  return round % 2 === 1 ? indexInRound : teamCount - indexInRound + 1;
}

export function overallPickForRoundAndSlot(
  round: number,
  draftSlot: number,
  teamCount: number,
): number {
  assertPositiveInteger(round, 'round');
  assertPositiveInteger(draftSlot, 'draftSlot');
  assertPositiveInteger(teamCount, 'teamCount');

  if (draftSlot > teamCount) {
    throw new Error('draftSlot cannot exceed teamCount');
  }

  const indexInRound = round % 2 === 1 ? draftSlot : teamCount - draftSlot + 1;
  return (round - 1) * teamCount + indexInRound;
}

export function nextUserOverallPick(
  currentOverallPick: number,
  config: Pick<DraftConfig, 'teamCount' | 'userDraftSlot'>,
): number {
  const currentRound = roundForOverallPick(Math.max(1, currentOverallPick), config.teamCount);

  for (let round = currentRound; round <= currentRound + 2; round += 1) {
    const candidate = overallPickForRoundAndSlot(round, config.userDraftSlot, config.teamCount);
    if (candidate >= currentOverallPick) return candidate;
  }

  throw new Error('Unable to determine next user pick');
}

export function picksForSlot(picks: DraftPick[], draftSlot: number): DraftPick[] {
  return picks.filter((pick) => pick.draftSlot === draftSlot);
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
}
