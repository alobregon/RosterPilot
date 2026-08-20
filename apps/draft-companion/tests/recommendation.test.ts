import { describe, expect, it } from 'vitest';
import { recommendPlayers } from '../lib/recommendation';
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

  it('defers kicker and DST early when no run is happening', () => {
    const specialPlayers: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 20, tier: 3 },
      { id: 'k-a', name: 'K A', position: 'K', overallRank: 1, tier: 1 },
      { id: 'dst-a', name: 'DST A', position: 'DST', overallRank: 2, tier: 1 },
    ];

    const early = recommendPlayers({
      players: specialPlayers,
      picks: [],
      config,
      currentOverallPick: 1,
      limit: 3,
    });

    expect(early[0].player.position).toBe('RB');
    expect(early.find((item) => item.player.id === 'dst-a')?.breakdown.rosterFit).toBe(10);
  });

  it('does not chase a single early DST selection', () => {
    const trendPlayers: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 20, tier: 3 },
      { id: 'dst-a', name: 'DST A', position: 'DST', overallRank: 30, tier: 2 },
      { id: 'dst-b', name: 'DST B', position: 'DST', overallRank: 31, tier: 2 },
    ];
    const picks: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'dst-b' },
    ];

    const result = recommendPlayers({
      players: trendPlayers,
      picks,
      config,
      currentOverallPick: 2,
      limit: 3,
    });

    expect(result.find((item) => item.player.id === 'dst-a')?.breakdown.rosterFit).toBe(10);
  });

  it('raises DST urgency when a real defense run develops', () => {
    const trendPlayers: PlayerRanking[] = [
      { id: 'rb-a', name: 'RB A', position: 'RB', overallRank: 20, tier: 3 },
      { id: 'wr-a', name: 'WR A', position: 'WR', overallRank: 21, tier: 3 },
      { id: 'dst-a', name: 'DST A', position: 'DST', overallRank: 30, tier: 2 },
      { id: 'dst-b', name: 'DST B', position: 'DST', overallRank: 31, tier: 2 },
      { id: 'dst-c', name: 'DST C', position: 'DST', overallRank: 32, tier: 2 },
      { id: 'dst-d', name: 'DST D', position: 'DST', overallRank: 33, tier: 2 },
    ];
    const picks: DraftPick[] = [
      { overallPick: 1, round: 1, pickInRound: 1, draftSlot: 1, playerId: 'dst-b' },
      { overallPick: 2, round: 1, pickInRound: 2, draftSlot: 2, playerId: 'wr-a' },
      { overallPick: 3, round: 1, pickInRound: 3, draftSlot: 3, playerId: 'dst-c' },
      { overallPick: 4, round: 1, pickInRound: 4, draftSlot: 4, playerId: 'rb-a' },
      { overallPick: 5, round: 1, pickInRound: 5, draftSlot: 5, playerId: 'dst-d' },
    ];

    const result = recommendPlayers({
      players: trendPlayers,
      picks,
      config,
      currentOverallPick: 6,
      limit: 6,
    });
    const dst = result.find((item) => item.player.id === 'dst-a');

    expect(dst?.breakdown.rosterFit).toBe(58);
    expect(dst?.reasons.some((reason) => reason.includes('3 DSTs selected'))).toBe(true);
  });
});
