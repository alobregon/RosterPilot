import { describe, expect, it } from 'vitest';
import { buildDraftBoard, rosterForSlot, rosterSize, totalDraftPicks } from '../lib/board';
import type { DraftConfig, DraftPick, PlayerRanking } from '../lib/types';

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

describe('draft board', () => {
  it('builds a 10-team, 16-round board for the default league', () => {
    expect(rosterSize(config)).toBe(16);
    expect(totalDraftPicks(config)).toBe(160);
    expect(buildDraftBoard(config, [], [])).toHaveLength(16);
  });

  it('keeps team columns fixed while snake pick numbers reverse', () => {
    const board = buildDraftBoard(config, [], []);
    expect(board[0].map((cell) => cell.overallPick)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(board[1].map((cell) => cell.overallPick)).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);
  });

  it('places picks and produces a team roster from the same draft state', () => {
    const players: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 1 },
      { id: 'wr-b', name: 'WR B', position: 'WR', overallRank: 2 },
    ];
    const picks: DraftPick[] = [
      { overallPick: 7, round: 1, pickInRound: 7, draftSlot: 7, playerId: 'rb-a' },
      { overallPick: 14, round: 2, pickInRound: 4, draftSlot: 7, playerId: 'wr-b' },
    ];

    const board = buildDraftBoard(config, picks, players);
    expect(board[0][6].player?.id).toBe('rb-a');
    expect(board[1][6].player?.id).toBe('wr-b');
    expect(rosterForSlot(7, picks, players).map((player) => player.id)).toEqual(['rb-a', 'wr-b']);
  });
});
