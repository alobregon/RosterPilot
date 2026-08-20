import { describe, expect, it } from 'vitest';
import {
  futureAvailabilityForPlayer,
  opponentPickOpportunities,
  recommendPlayers,
  relativeRecommendationPercents,
} from '../lib/recommendation';
import { followingUserOverallPick } from '../lib/draft';
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
  draftStrategy: 'BALANCED',
};

describe('future availability', () => {
  it('targets the following user turn, not the current selection', () => {
    expect(followingUserOverallPick(7, config)).toBe(14);
    expect(opponentPickOpportunities(7, 14, 10, 7)).toEqual([8, 9, 10, 10, 9, 8]);
  });

  it('detects strong opponent RB demand between turns', () => {
    const players: PlayerRanking[] = [
      { id: 'wr8', name: 'WR 8', position: 'WR', overallRank: 1 },
      { id: 'qb8', name: 'QB 8', position: 'QB', overallRank: 2 },
      { id: 'wr9', name: 'WR 9', position: 'WR', overallRank: 3 },
      { id: 'qb9', name: 'QB 9', position: 'QB', overallRank: 4 },
      { id: 'wr10', name: 'WR 10', position: 'WR', overallRank: 5 },
      { id: 'qb10', name: 'QB 10', position: 'QB', overallRank: 6 },
      { id: 'rb', name: 'Candidate RB', position: 'RB', overallRank: 25, tier: 3 },
    ];
    const picks: DraftPick[] = [
      { overallPick: 8, round: 1, pickInRound: 8, draftSlot: 8, playerId: 'wr8' },
      { overallPick: 13, round: 2, pickInRound: 3, draftSlot: 8, playerId: 'qb8' },
      { overallPick: 9, round: 1, pickInRound: 9, draftSlot: 9, playerId: 'wr9' },
      { overallPick: 12, round: 2, pickInRound: 2, draftSlot: 9, playerId: 'qb9' },
      { overallPick: 10, round: 1, pickInRound: 10, draftSlot: 10, playerId: 'wr10' },
      { overallPick: 11, round: 2, pickInRound: 1, draftSlot: 10, playerId: 'qb10' },
    ];

    const result = futureAvailabilityForPlayer(players[6], [players[6]], picks, players, config, 27);
    expect(result.returnPick).toBe(34);
    expect(result.interveningPicks).toBe(6);
    expect(result.uniqueOpponentTeams).toBe(3);
    expect(result.strongNeedTeams).toBe(3);
    expect(result.label).toBe('UNLIKELY');
  });

  it('does not invent a return pick after the draft ends', () => {
    const player: PlayerRanking = { id: 'wr', name: 'Final WR', position: 'WR', overallRank: 150 };
    const result = futureAvailabilityForPlayer(player, [player], [], [player], config, 154);
    expect(result.returnPick).toBeNull();
    expect(result.label).toBe('FINAL_PICK');
  });
});

describe('single recommendation percentage', () => {
  it('always sums the displayed recommendations to 100 percent', () => {
    expect(relativeRecommendationPercents([90, 89, 88])).toEqual([38, 33, 29]);
    expect(relativeRecommendationPercents([90])).toEqual([100]);
  });

  it('exposes one public percentage instead of strength plus share', () => {
    const players: PlayerRanking[] = [
      { id: 'a', name: 'A', position: 'WR', overallRank: 1, tier: 1 },
      { id: 'b', name: 'B', position: 'RB', overallRank: 2, tier: 1 },
      { id: 'c', name: 'C', position: 'WR', overallRank: 3, tier: 1 },
    ];
    const result = recommendPlayers({ players, picks: [], config, currentOverallPick: 1, limit: 3 });
    expect(result.reduce((sum, item) => sum + item.recommendationPercent, 0)).toBe(100);
    expect(result.some((item) => 'strength' in item)).toBe(false);
  });
});
