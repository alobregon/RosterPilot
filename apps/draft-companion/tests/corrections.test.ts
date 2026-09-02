import { describe, expect, it } from 'vitest';
import { nextOpenOverallPick } from '../lib/board';
import { removeDraftPick, replaceDraftPick } from '../lib/corrections';
import type { DraftConfig, DraftPick } from '../lib/types';

const config: DraftConfig = {
  teamCount: 10,
  userDraftSlot: 7,
  scoringFormat: 'HALF_PPR',
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
  dstStarters: 1,
  kStarters: 1,
  benchSpots: 6,
};

const picks: DraftPick[] = Array.from({ length: 15 }, (_, index) => {
  const overallPick = index + 1;
  return replaceDraftPick([], overallPick, `p-${overallPick}`, config.teamCount)[0];
});

describe('draft corrections', () => {
  it('replaces a historical player without shifting later snake assignments', () => {
    const corrected = replaceDraftPick(picks, 8, 'replacement', config.teamCount);
    expect(corrected).toHaveLength(15);
    expect(corrected.find((pick) => pick.overallPick === 8)?.playerId).toBe('replacement');
    expect(corrected.find((pick) => pick.overallPick === 11)?.draftSlot).toBe(10);
    expect(corrected.find((pick) => pick.overallPick === 15)?.draftSlot).toBe(6);
  });

  it('makes a removed historical pick the next open selection', () => {
    const removed = removeDraftPick(picks, 8);
    expect(nextOpenOverallPick(removed, config)).toBe(8);
  });

  it('returns the next sequential pick when there is no correction gap', () => {
    expect(nextOpenOverallPick(picks, config)).toBe(16);
  });
});
