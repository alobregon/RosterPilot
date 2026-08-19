import { describe, expect, it } from 'vitest';
import { recommendPlayers } from '../lib/recommendation';
import type { DraftConfig, DraftPick, PlayerRanking } from '../lib/types';

const config: DraftConfig = {
  teamCount: 10,
  userDraftSlot: 7,
  qbStarters: 1,
  rbStarters: 2,
  wrStarters: 3,
  teStarters: 1,
  flexStarters: 1,
};

const players: PlayerRanking[] = [
  { id: 'rb-1', name: 'RB One', position: 'RB', overallRank: 1, tier: 1 },
  { id: 'wr-2', name: 'WR Two', position: 'WR', overallRank: 2, tier: 1 },
  { id: 'wr-3', name: 'WR Three', position: 'WR', overallRank: 3, tier: 2 },
  { id: 'wr-4', name: 'WR Four', position: 'WR', overallRank: 4, tier: 3 },
  { id: 'rb-5', name: 'RB Five', position: 'RB', overallRank: 5, tier: 2 },
  { id: 'qb-6', name: 'QB Six', position: 'QB', overallRank: 6, tier: 1 },
];

describe('recommendation engine', () => {
  it('returns three ranked recommendations', () => {
    const result = recommendPlayers({ players, picks: [], config, currentOverallPick: 1 });
    expect(result).toHaveLength(3);
    expect(result[0].strength).toBeGreaterThanOrEqual(result[1].strength);
  });

  it('does not recommend drafted players', () => {
    const picks: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'rb-1' },
    ];
    const result = recommendPlayers({ players, picks, config, currentOverallPick: 2 });
    expect(result.some((item) => item.player.id === 'rb-1')).toBe(false);
  });

  it('surfaces tier urgency as an explanation', () => {
    const result = recommendPlayers({ players, picks: [], config, currentOverallPick: 1, limit: 6 });
    const player = result.find((item) => item.player.id === 'wr-4');
    expect(player?.reasons.some((reason) => reason.includes('Final WR'))).toBe(true);
  });
});
