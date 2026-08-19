import { describe, expect, it } from 'vitest';
import {
  draftSlotForOverallPick,
  nextUserOverallPick,
  overallPickForRoundAndSlot,
  pickInRound,
  roundForOverallPick,
} from '../lib/draft';

describe('snake draft utilities', () => {
  it('maps odd rounds in ascending slot order', () => {
    expect(draftSlotForOverallPick(1, 10)).toBe(1);
    expect(draftSlotForOverallPick(10, 10)).toBe(10);
  });

  it('maps even rounds in descending slot order', () => {
    expect(draftSlotForOverallPick(11, 10)).toBe(10);
    expect(draftSlotForOverallPick(20, 10)).toBe(1);
  });

  it('calculates round and pick-in-round display values', () => {
    expect(roundForOverallPick(17, 10)).toBe(2);
    expect(pickInRound(17, 10)).toBe(7);
  });

  it('finds a user slot overall pick in either round direction', () => {
    expect(overallPickForRoundAndSlot(1, 7, 10)).toBe(7);
    expect(overallPickForRoundAndSlot(2, 7, 10)).toBe(14);
  });

  it('finds the next user pick from the current board state', () => {
    expect(nextUserOverallPick(1, { teamCount: 10, userDraftSlot: 7 })).toBe(7);
    expect(nextUserOverallPick(8, { teamCount: 10, userDraftSlot: 7 })).toBe(14);
    expect(nextUserOverallPick(15, { teamCount: 10, userDraftSlot: 7 })).toBe(27);
  });
});
