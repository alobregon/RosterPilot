import { describe, expect, it } from 'vitest';
import { draftPickAtOverall, undoLatestSimulatorUserDecision } from '../lib/corrections';


describe('simulator undo', () => {
  it('removes the latest user pick and all downstream simulated opponent picks', () => {
    const picks = [
      draftPickAtOverall(1, 'opponent-1', 4),
      draftPickAtOverall(2, 'user-round-1', 4),
      draftPickAtOverall(3, 'opponent-3', 4),
      draftPickAtOverall(4, 'opponent-4', 4),
      draftPickAtOverall(5, 'opponent-5', 4),
      draftPickAtOverall(6, 'opponent-6', 4),
    ];

    const result = undoLatestSimulatorUserDecision(picks, 2);

    expect(result.map((pick) => pick.overallPick)).toEqual([1]);
    expect(result.some((pick) => pick.playerId === 'user-round-1')).toBe(false);
  });

  it('undoes only the most recent user decision when multiple user rounds exist', () => {
    const picks = [
      draftPickAtOverall(1, 'opponent-1', 4),
      draftPickAtOverall(2, 'user-round-1', 4),
      draftPickAtOverall(3, 'opponent-3', 4),
      draftPickAtOverall(4, 'opponent-4', 4),
      draftPickAtOverall(5, 'opponent-5', 4),
      draftPickAtOverall(6, 'opponent-6', 4),
      draftPickAtOverall(7, 'user-round-2', 4),
      draftPickAtOverall(8, 'opponent-8', 4),
      draftPickAtOverall(9, 'opponent-9', 4),
    ];

    const result = undoLatestSimulatorUserDecision(picks, 2);

    expect(result.map((pick) => pick.overallPick)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.some((pick) => pick.playerId === 'user-round-1')).toBe(true);
    expect(result.some((pick) => pick.playerId === 'user-round-2')).toBe(false);
  });

  it('does nothing before the user has made a simulator selection', () => {
    const picks = [draftPickAtOverall(1, 'opponent-1', 4)];

    expect(undoLatestSimulatorUserDecision(picks, 2)).toEqual(picks);
  });
});
